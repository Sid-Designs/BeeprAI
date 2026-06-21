const cleanText = (value = "", max = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const buildQueryIntentFlags = (lastUserMessage = "") => {
  const text = cleanText(lastUserMessage, 500).toLowerCase();
  return {
    askedFees: /\b(fee|fees|price|pricing|cost)\b/.test(text),
    askedEligibility: /\b(eligib|criteria|qualif)\b/.test(text),
    askedSchedule: /\b(schedule|appointment|book|callback|call back|talk later)\b/.test(text),
    soundedUnsure: /\b(not sure|maybe|let me think|need time)\b/.test(text),
    raisedObjection: /\b(expensive|too much|later|busy|not now|send details)\b/.test(text),
  };
};

const deriveOutcomeType = ({
  objective = "",
  leadStatus = "",
  callbackRequested = false,
  collectedData = {},
  endReason = "",
  isClosed = false,
  telemetry = {},
} = {}) => {
  const objectiveKey = cleanText(objective, 80).toLowerCase();
  const leadKey = cleanText(leadStatus, 80).toLowerCase();
  const reasonKey = cleanText(endReason, 120).toLowerCase();

  if (callbackRequested || reasonKey === "user_requested_callback") return "callback_scheduled";
  if (collectedData?.appointmentRequested && (collectedData?.appointmentSchedule?.preferredDate || collectedData?.appointmentSchedule?.preferredTime)) {
    return "appointment_ready";
  }
  if (collectedData?.appointmentRequested || reasonKey === "appointment_requested") {
    return "appointment_requested";
  }
  if (
    objectiveKey === "appointment_booking" &&
    (collectedData?.preferred_date || collectedData?.preferred_time || leadKey === "qualified")
  ) {
    return "appointment_ready";
  }
  if (leadKey === "qualified") return "lead_qualified";
  if (objectiveKey === "support_inquiry" && !telemetry?.kbGateTriggered && !reasonKey.includes("not_interested")) {
    return "query_resolved";
  }
  if (reasonKey === "user_not_interested" || leadKey === "not_interested") return "lead_lost";
  if (telemetry?.kbGateTriggered) return "knowledge_gap";
  if (isClosed) return "closed_without_conversion";
  return "in_progress";
};

const computeSuccessScore = ({
  outcomeType = "",
  leadStatus = "",
  turnCount = 0,
  qualityScore = 0,
  telemetry = {},
} = {}) => {
  let score = 45;
  const outcomeKey = cleanText(outcomeType, 80).toLowerCase();
  const leadKey = cleanText(leadStatus, 80).toLowerCase();

  if (outcomeKey === "callback_scheduled") score = 78;
  if (outcomeKey === "appointment_requested") score = 72;
  if (outcomeKey === "appointment_ready") score = 90;
  if (outcomeKey === "lead_qualified") score = 84;
  if (outcomeKey === "query_resolved") score = 80;
  if (outcomeKey === "knowledge_gap") score = 35;
  if (outcomeKey === "lead_lost") score = 15;
  if (outcomeKey === "closed_without_conversion") score = 28;

  if (leadKey === "qualified") score = Math.max(score, 84);
  if (leadKey === "interested") score = Math.max(score, 64);
  if (leadKey === "unsure") score = Math.min(score, 52);
  if (leadKey === "not_interested") score = Math.min(score, 15);

  if (Number(qualityScore || 0) > 0) {
    score = Math.round((score * 0.7) + (Number(qualityScore) * 0.3));
  }
  if (Number(turnCount || 0) >= 12) score -= 6;
  if (telemetry?.stalledTurns >= 2) score -= 8;
  if (telemetry?.kbGateTriggered) score -= 10;

  return Math.max(0, Math.min(100, score));
};

const deriveImprovementTags = ({
  outcomeType = "",
  turnCount = 0,
  telemetry = {},
  lastUserMessage = "",
  leadStatus = "",
} = {}) => {
  const tags = [];
  const intentFlags = buildQueryIntentFlags(lastUserMessage);

  if (telemetry?.kbGateTriggered || outcomeType === "knowledge_gap") tags.push("knowledge_gap");
  if (Number(turnCount || 0) >= 12 || Number(telemetry?.stalledTurns || 0) >= 2) tags.push("conversation_efficiency");
  if (intentFlags.raisedObjection || leadStatus === "unsure") tags.push("objection_handling");
  if (intentFlags.askedSchedule && outcomeType !== "callback_scheduled" && outcomeType !== "appointment_ready") {
    tags.push("booking_conversion");
  }
  if (intentFlags.askedFees && outcomeType === "knowledge_gap") tags.push("pricing_coverage");
  if (intentFlags.soundedUnsure) tags.push("nurture_followup");

  return Array.from(new Set(tags));
};

const buildCoachingSuggestion = ({
  outcomeType = "",
  tags = [],
  lastUserMessage = "",
  telemetry = {},
} = {}) => {
  if (tags.includes("knowledge_gap")) {
    return "Expand knowledge coverage for high-frequency factual questions and make the fallback next step more specific.";
  }
  if (tags.includes("booking_conversion")) {
    return "Offer a concrete appointment or callback slot earlier when the caller shows scheduling intent.";
  }
  if (tags.includes("objection_handling")) {
    return "Use a sharper objection playbook that answers the concern first, then asks one next-step question.";
  }
  if (tags.includes("conversation_efficiency")) {
    return "Shorten the path to qualification by asking fewer repeated questions and moving to the next step sooner.";
  }
  if (telemetry?.goalDelta === "moved_closer") {
    return "Keep this response style as a positive template for similar calls.";
  }
  if (cleanText(lastUserMessage, 120)) {
    return "Review this call for a stronger next-best-action after the user's latest message.";
  }
  return "No urgent coaching signal detected for this call.";
};

export const buildCallLearningSnapshot = ({
  objective = "",
  stage = "",
  leadStatus = "",
  collectedData = {},
  summary = "",
  endReason = "",
  isClosed = false,
  turnCount = 0,
  lastUserMessage = "",
  lastAssistantMessage = "",
  callbackRequested = false,
  callbackSchedule = null,
  telemetry = {},
  qualityScore = 0,
  intentInsight = {},
} = {}) => {
  const outcomeType = deriveOutcomeType({
    objective,
    leadStatus,
    callbackRequested,
    collectedData,
    endReason,
    isClosed,
    telemetry,
  });
  const successScore = computeSuccessScore({
    outcomeType,
    leadStatus,
    turnCount,
    qualityScore,
    telemetry,
  });
  const improvementTags = deriveImprovementTags({
    outcomeType,
    turnCount,
    telemetry,
    lastUserMessage,
    leadStatus,
  });

  return {
    outcomeType,
    successScore,
    improvementTags,
    coachingSuggestion: buildCoachingSuggestion({
      outcomeType,
      tags: improvementTags,
      lastUserMessage,
      telemetry,
    }),
    bookingReadiness:
      cleanText(intentInsight?.bookingReadiness || telemetry?.bookingReadiness, 40) === "ready"
        ? 90
        : cleanText(intentInsight?.bookingReadiness || telemetry?.bookingReadiness, 40) === "probing"
          ? 70
          : cleanText(intentInsight?.bookingReadiness || telemetry?.bookingReadiness, 40) === "declined"
            ? 20
            : (Boolean(collectedData?.preferred_date) || Boolean(collectedData?.preferred_time) || Boolean(callbackSchedule))
              ? 85
              : Number(telemetry?.intentScore || 0) >= 80
                ? 78
                : Number(telemetry?.intentScore || 0) >= 60
                  ? 62
                  : 35,
    queryResolutionConfidence: outcomeType === "query_resolved"
      ? 82
      : telemetry?.kbGateTriggered
        ? 25
        : /i do not have that exact detail/i.test(cleanText(lastAssistantMessage, 200))
          ? 35
          : 58,
    summary: cleanText(summary, 160),
    latestStage: cleanText(stage, 60),
    latestEndReason: cleanText(endReason, 120),
    intentResolutionMs: Number(intentInsight?.intentResolutionMs || telemetry?.intentResolutionMs || 0) || null,
    intentResolvedAtTurn: Number(intentInsight?.intentResolvedAtTurn || telemetry?.intentResolvedAtTurn || 0) || null,
    primaryIntent: cleanText(intentInsight?.primaryIntent || telemetry?.userIntent, 80) || "unknown",
    intentConfidence: Number(intentInsight?.confidence || telemetry?.intentConfidence || 0),
  };
};
