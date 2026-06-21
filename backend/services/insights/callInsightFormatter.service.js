const cleanText = (value, max = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const STALLED_TURNS_THRESHOLD = Number.parseInt(
  process.env.CALL_INSIGHT_STALLED_TURNS || "3",
  10,
);

const asObject = (value) => (value && typeof value === "object" ? value : {});

const formatCallbackWhen = (record = {}, collected = {}) => {
  const fromAnalysis = [record.appointmentDate, record.appointmentTime].filter(Boolean).join(" at ");
  if (fromAnalysis) return fromAnalysis;

  const callbackSchedule = asObject(collected.callbackSchedule);
  const scheduleText = cleanText(callbackSchedule.text || callbackSchedule.when, 80);
  if (scheduleText) return scheduleText;

  const date = cleanText(collected.callback_date || collected.preferred_date, 80);
  const time = cleanText(collected.callback_time || collected.preferred_time, 40);
  return [date, time].filter(Boolean).join(" at ");
};

/**
 * Turn call signals into 1–5 plain-English insights for tenant dashboards.
 */
export const formatCallInsights = (record = {}) => {
  const insights = [];
  const seen = new Set();

  const push = (text) => {
    const message = cleanText(text);
    if (!message || seen.has(message)) return;
    seen.add(message);
    insights.push(message);
  };

  const analysisStatus = cleanText(record.analysisStatus, 40).toLowerCase();
  const outcome = cleanText(record.outcome, 80).toLowerCase();
  const endReason = cleanText(record.endReason, 200).toLowerCase();
  const metadata = asObject(record.metadata);
  const analytics = asObject(metadata.analytics);
  const collected = asObject(record.collectedInformation);
  const stalledTurns = Number(analytics.stalledTurns);
  const kbGateTriggered =
    analytics.kbGateTriggered === true || metadata.kbGateTriggered === true;

  if (analysisStatus === "failed") {
    push("Report generation failed — partial data shown");
  }

  if (kbGateTriggered) {
    push("Agent didn't have verified info for this question");
  }

  if (outcome === "not_interested" || endReason.includes("not_interested")) {
    push("Customer declined");
  }

  if (outcome === "callback_scheduled" || endReason.includes("callback")) {
    const when = formatCallbackWhen(record, collected);
    push(when ? `Callback requested at ${when}` : "Callback requested");
  }

  if (Number.isFinite(stalledTurns) && stalledTurns >= STALLED_TURNS_THRESHOLD) {
    push("Conversation looped without progress");
  }

  if (outcome === "appointment_booked" || record.appointmentBooked === true) {
    const when = formatCallbackWhen(record, collected);
    push(when ? `Appointment booked for ${when}` : "Appointment booked on the call");
  }

  if (outcome === "abandoned" || endReason.includes("abandon") || endReason.includes("user_hangup") || endReason.includes("user_left")) {
    push("Customer left before the conversation finished");
  }

  if (outcome === "unanswered" || endReason.includes("no_answer") || endReason.includes("unanswered")) {
    push("Customer did not answer the call");
  }

  if (outcome === "qualified_lead") {
    push("Lead qualified — follow up while interest is high");
  }

  const objections = Array.isArray(record.objections)
    ? record.objections.map((item) => cleanText(item, 120)).filter(Boolean)
    : [];

  for (const objection of objections.slice(0, 2)) {
    push(`Customer raised: ${objection}`);
  }

  if (!insights.length && outcome === "information_provided") {
    push("Customer received the information they asked for");
  }

  if (!insights.length && analysisStatus === "completed") {
    push("Call completed — review the summary and transcript for details");
  }

  return insights.slice(0, 5);
};
