import axios from "axios";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.POST_CALL_LLM_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = Number.parseInt(process.env.POST_CALL_LLM_TIMEOUT_MS || "30000", 10);
const POST_CALL_MAX_RETRIES = Number.parseInt(process.env.POST_CALL_MAX_RETRIES || "2", 10);

const PRIMARY_INTENTS = new Set([
  "admission_inquiry",
  "fee_inquiry",
  "appointment_booking",
  "support_request",
  "callback_request",
  "information_request",
  "unknown",
]);

const OUTCOMES = new Set([
  "appointment_booked",
  "callback_scheduled",
  "qualified_lead",
  "information_provided",
  "not_interested",
  "abandoned",
  "unanswered",
  "unknown",
]);

const SENTIMENTS = new Set(["positive", "neutral", "negative"]);

const cleanText = (value = "", max = 2000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const clampScore = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const extractJsonObject = (raw = "") => {
  const text = cleanText(raw, 16000);
  if (!text) return null;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last < first) return null;

  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
};

const normalizeStringList = (values = [], max = 8) => {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  for (const item of values) {
    const value = cleanText(item, 120).toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= max) break;
  }

  return result;
};

const normalizeCollectedInformation = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};

  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = cleanText(key, 60).replace(/\s+/g, "_").toLowerCase();
    if (!normalizedKey) continue;
    const normalizedValue = cleanText(raw, 200);
    if (!normalizedValue) continue;
    result[normalizedKey] = normalizedValue;
  }

  return result;
};

export const validatePostCallAnalysis = (parsed = {}, context = {}) => {
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, reason: "missing_json" };
  }

  const primaryIntent = cleanText(parsed.primary_intent || parsed.primaryIntent, 80).toLowerCase();
  const outcome = cleanText(parsed.outcome, 80).toLowerCase();
  const sentiment = cleanText(parsed.sentiment, 20).toLowerCase();
  const summary = cleanText(parsed.summary, 1200);

  if (!summary || summary.length < 20) {
    return { valid: false, reason: "summary_too_short" };
  }

  const normalized = {
    summary,
    primaryIntent: PRIMARY_INTENTS.has(primaryIntent) ? primaryIntent : "unknown",
    secondaryIntents: normalizeStringList(parsed.secondary_intents || parsed.secondaryIntents),
    outcome: OUTCOMES.has(outcome) ? outcome : inferOutcomeFromContext(context),
    leadScore: clampScore(parsed.lead_score ?? parsed.leadScore, 0),
    sentiment: SENTIMENTS.has(sentiment) ? sentiment : "neutral",
    objections: normalizeStringList(parsed.objections),
    collectedInformation: normalizeCollectedInformation(
      parsed.collected_information || parsed.collectedInformation,
    ),
    appointmentBooked: Boolean(parsed.appointment_booked ?? parsed.appointmentBooked),
    appointmentDate: cleanText(parsed.appointment_date || parsed.appointmentDate, 80),
    appointmentTime: cleanText(parsed.appointment_time || parsed.appointmentTime, 40),
    nextAction: cleanText(parsed.next_action || parsed.nextAction, 240),
  };

  if (context?.callState?.collectedData && typeof context.callState.collectedData === "object") {
    normalized.collectedInformation = {
      ...normalizeCollectedInformation(context.callState.collectedData),
      ...normalized.collectedInformation,
    };
  }

  if (
    normalized.outcome === "appointment_booked" ||
    context?.callState?.bookingStatus === "completed" ||
    context?.callState?.objectiveAchieved
  ) {
    normalized.appointmentBooked = Boolean(
      normalized.appointmentBooked ||
        context?.callState?.collectedData?.preferred_date ||
        context?.callState?.collectedData?.preferred_time,
    );
    if (!normalized.appointmentDate) {
      normalized.appointmentDate = cleanText(context?.callState?.collectedData?.preferred_date, 80);
    }
    if (!normalized.appointmentTime) {
      normalized.appointmentTime = cleanText(context?.callState?.collectedData?.preferred_time, 40);
    }
  }

  return { valid: true, analysis: normalized };
};

export const inferOutcomeFromContext = (context = {}) => {
  const endReason = cleanText(context.endReason, 120).toLowerCase();
  const callState = context.callState || {};
  const leadStatus = cleanText(callState.leadStatus, 40).toLowerCase();
  const bookingStatus = cleanText(callState.bookingStatus, 40).toLowerCase();
  const turnCount = Number(callState.turnCount || 0);

  if (bookingStatus === "completed" || endReason.includes("appointment_confirmed")) {
    return "appointment_booked";
  }
  if (callState.collectedData?.appointmentId || callState.collectedData?.appointmentConfirmed) {
    return "appointment_booked";
  }
  if (endReason.includes("callback") || callState.collectedData?.callbackRequested) {
    return "callback_scheduled";
  }
  if (leadStatus === "not_interested" || endReason.includes("not_interested")) {
    return "not_interested";
  }
  if (endReason.includes("no_answer") || endReason.includes("unanswered")) {
    return "unanswered";
  }
  if (endReason.includes("silence") || endReason.includes("abandon") || turnCount <= 1) {
    return "abandoned";
  }
  if (leadStatus === "qualified" || leadStatus === "interested") {
    return "qualified_lead";
  }
  if (turnCount > 1) {
    return "information_provided";
  }
  return "unknown";
};

const buildAnalysisPrompt = ({ transcriptText, metadataBlock }) => `
You are a post-call intelligence analyst for a voice calling agent.

Analyze the completed call and return ONLY valid JSON with this exact shape:
{
  "summary": "2-5 sentence call summary",
  "primary_intent": "admission_inquiry|fee_inquiry|appointment_booking|support_request|callback_request|information_request|unknown",
  "secondary_intents": ["intent1", "intent2"],
  "outcome": "appointment_booked|callback_scheduled|qualified_lead|information_provided|not_interested|abandoned|unanswered|unknown",
  "lead_score": 0,
  "sentiment": "positive|neutral|negative",
  "objections": ["fees too high", "needs more time"],
  "collected_information": { "name": "...", "course_interest": "..." },
  "appointment_booked": false,
  "appointment_date": "",
  "appointment_time": "",
  "next_action": "counselor follow-up"
}

Rules:
- summary must be 2-5 sentences, factual, past tense.
- lead_score is 0-100 based on interest, engagement, appointment readiness, and positive responses.
- Use secondary_intents for every distinct intent detected across the call.
- objections should list real objections raised by the caller (empty array if none).
- collected_information should include name, phone, course interest, callback time, graduation stream, etc. when mentioned.
- next_action must be a concrete recommended follow-up.
- If appointment was confirmed, set outcome=appointment_booked and appointment_booked=true.
- If caller only wanted information and declined booking, outcome=information_provided.
- Do not invent facts not supported by the transcript or metadata.

CALL METADATA:
${metadataBlock}

TRANSCRIPT:
${transcriptText}
`.trim();

const buildMetadataBlock = (context = {}) => {
  const callState = context.callState || {};
  const lines = [
    `Objective: ${cleanText(context.objective, 80) || "custom"}`,
    `End reason: ${cleanText(context.endReason, 120) || "unknown"}`,
    `Final stage: ${cleanText(callState.stage, 60) || "unknown"}`,
    `Lead status: ${cleanText(callState.leadStatus, 40) || "new"}`,
    `Booking status: ${cleanText(callState.bookingStatus, 40) || "none"}`,
    `Turn count: ${Number(callState.turnCount || 0)}`,
    `Intent: ${cleanText(callState.userIntent?.intent || callState.intentInsight?.primaryIntent, 60) || "unknown"}`,
    `Phone: ${cleanText(context.phoneNumber, 40) || "unknown"}`,
    `Duration seconds: ${Math.round(Number(context.durationSeconds || 0))}`,
  ];

  if (callState.collectedData && typeof callState.collectedData === "object") {
    lines.push(`Collected data: ${JSON.stringify(callState.collectedData)}`);
  }

  return lines.join("\n");
};

const callGroqAnalysis = async ({ messages }) => {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");

  const response = await axios.post(
    GROQ_URL,
    {
      model: GROQ_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      timeout: GROQ_TIMEOUT_MS,
    },
  );

  return response.data?.choices?.[0]?.message?.content || "";
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyzeCallWithLLM = async (context = {}) => {
  const transcriptText = cleanText(context.transcriptText, 14000);
  const metadataBlock = buildMetadataBlock(context);
  const messages = [
    {
      role: "system",
      content: "Return only valid JSON. No markdown. No commentary.",
    },
    {
      role: "user",
      content: buildAnalysisPrompt({ transcriptText, metadataBlock }),
    },
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= POST_CALL_MAX_RETRIES; attempt += 1) {
    try {
      const raw = await callGroqAnalysis({ messages });
      const parsed = extractJsonObject(raw);
      const validation = validatePostCallAnalysis(parsed, context);
      if (validation.valid) {
        return { success: true, analysis: validation.analysis, source: "llm", raw };
      }
      lastError = new Error(validation.reason || "validation_failed");
    } catch (error) {
      lastError = error;
    }

    if (attempt < POST_CALL_MAX_RETRIES) {
      await sleep(400 * (attempt + 1));
    }
  }

  return {
    success: false,
    error: lastError?.message || "llm_analysis_failed",
    source: "llm",
  };
};

export const buildRuleBasedAnalysis = (context = {}) => {
  const callState = context.callState || {};
  const collected = callState.collectedData || {};
  const primaryIntent =
    cleanText(callState.userIntent?.intent || callState.intentInsight?.primaryIntent, 80).toLowerCase() ||
    "information_request";
  let outcome = inferOutcomeFromContext(context);
  const turnCount = Number(callState.turnCount || 0);
  const leadStatus = cleanText(callState.leadStatus, 40).toLowerCase();

  let leadScore = 20;
  if (leadStatus === "interested") leadScore += 25;
  if (leadStatus === "qualified") leadScore += 35;
  if (outcome === "appointment_booked") leadScore = Math.max(leadScore, 85);
  if (outcome === "callback_scheduled") leadScore = Math.max(leadScore, 65);
  if (outcome === "not_interested") leadScore = Math.min(leadScore, 15);
  if (turnCount >= 4) leadScore += 10;
  if (collected.name) leadScore += 8;
  if (collected.preferred_date || collected.preferred_time) leadScore += 12;

  const objections = [];
  if (String(context.endReason || "").includes("not_interested")) {
    objections.push("not interested");
  }
  if (collected.objection) {
    objections.push(cleanText(collected.objection, 80));
  }

  const appointmentBooked =
    outcome === "appointment_booked" ||
    Boolean(collected.appointmentId) ||
    Boolean(collected.appointmentConfirmed);
  if (appointmentBooked) {
    outcome = "appointment_booked";
  }
  const summaryParts = [];
  if (collected.course_interest || collected.interest) {
    summaryParts.push(
      `The caller inquired about ${cleanText(collected.course_interest || collected.interest, 80)}.`,
    );
  } else {
    summaryParts.push("The caller spoke with the AI agent.");
  }
  if (appointmentBooked) {
    summaryParts.push(
      `An appointment was booked for ${cleanText(collected.preferred_date, 40) || "the requested date"} at ${cleanText(collected.preferred_time, 30) || "the requested time"}.`,
    );
  } else if (outcome === "callback_scheduled") {
    summaryParts.push("The caller requested a callback.");
  } else if (outcome === "information_provided") {
    summaryParts.push("Information was provided during the call.");
  } else if (outcome === "not_interested") {
    summaryParts.push("The caller was not interested in proceeding.");
  }

  const nextActionByOutcome = {
    appointment_booked: "counselor follow-up before appointment",
    callback_scheduled: "call back at the agreed time",
    qualified_lead: "counselor follow-up",
    information_provided: "send admission details if contact available",
    not_interested: "no action required",
    abandoned: "retry call later",
    unanswered: "retry call later",
    unknown: "review transcript manually",
  };

  return {
    summary: summaryParts.join(" ").slice(0, 1200),
    primaryIntent: PRIMARY_INTENTS.has(primaryIntent) ? primaryIntent : "information_request",
    secondaryIntents: normalizeStringList([primaryIntent]),
    outcome,
    leadScore: clampScore(leadScore, 20),
    sentiment: outcome === "not_interested" ? "negative" : outcome === "appointment_booked" ? "positive" : "neutral",
    objections: normalizeStringList(objections),
    collectedInformation: normalizeCollectedInformation(collected),
    appointmentBooked,
    appointmentDate: cleanText(collected.preferred_date, 80),
    appointmentTime: cleanText(collected.preferred_time, 40),
    nextAction: nextActionByOutcome[outcome] || "review transcript manually",
  };
};
