import { detectIntentLabel } from "../policy/dialoguePolicyEngine.service.js";
import { classifyUserIntentWithLlm } from "../llm.service.js";
import { isSchedulingOrBookingRequest, isCounselorConnectRequest } from "./conversationPlaybook.service.js";

export const USER_INTENTS = Object.freeze([
  "appointment_booking",
  "information_request",
  "fee_inquiry",
  "admission_inquiry",
  "support_request",
  "callback_request",
  "objection",
  "unknown",
]);

export const INTENT_CONFIDENCE_THRESHOLD = Number.parseFloat(
  process.env.INTENT_CONFIDENCE_THRESHOLD || "0.75",
);

export const ENABLE_LLM_INTENT_FALLBACK =
  String(process.env.ENABLE_LLM_INTENT_FALLBACK || "false").toLowerCase() === "true";

const LLM_INTENT_SKIP_SOURCES = new Set(["signal", "greeting", "empty", "appointment_signal"]);

const cleanText = (value = "", max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const INTENT_PATTERNS = [
  {
    intent: "appointment_booking",
    score: 0.92,
    patterns: [
      /\b(book(?:ing)?|schedul(?:e|ing|ed)|set|fix|arrange)\b.*\b(a+p+ointments?|appointments?|meeting|counsell?(?:ing|or)?|counselou?r(?:\s+call)?|slot|call)\b/i,
      /\b(a+p+ointments?|appointments?)\b/i,
      /\b(want to|like to|need to)\s+(book|schedul\w*)\b/i,
      /\bscheduling\b.*\b(request|counselou?r|call|appointment)\b/i,
    ],
  },
  {
    intent: "callback_request",
    score: 0.88,
    patterns: [
      /\b(call (?:me )?back|callback|call later|talk later|call again)\b/i,
      /\b(i am busy|i'm busy|im busy|busy now)\b/i,
    ],
  },
  {
    intent: "fee_inquiry",
    score: 0.9,
    patterns: [
      /\b(fee|fees|cost|price|pricing|tuition|how much)\b/i,
      /\b(expensive|too costly|afford)\b/i,
    ],
  },
  {
    intent: "admission_inquiry",
    score: 0.88,
    patterns: [
      /\b(admission|apply|application|enroll|enrol|eligibility|eligible)\b/i,
      /\b(mca|mba|bca|bba|b\.?com|btech|mtech|course|program|degree)\b/i,
      /\b(admission process|how to apply|admission steps)\b/i,
    ],
  },
  {
    intent: "support_request",
    score: 0.82,
    patterns: [
      /\b(help|support|assist|issue|problem|complaint|not working)\b/i,
      /\b(guide me|need help)\b/i,
    ],
  },
  {
    intent: "information_request",
    score: 0.78,
    patterns: [
      /\b(tell me|information|details|more about|explain|what is|how does)\b/i,
      /\b(brochure|syllabus|curriculum|duration|placement)\b/i,
    ],
  },
];

const LABEL_TO_INTENT = Object.freeze({
  admission_query: "admission_inquiry",
  callback: "callback_request",
  help_request: "support_request",
  closing: "unknown",
  ack: "unknown",
  general_query: "information_request",
});

const GREETING_ONLY_RE =
  /^(hi|hello|hey|good (morning|afternoon|evening)|namaste|namaskar)[!,. ]*$/i;

const scoreFromPatterns = (text, entries) => {
  let best = { intent: "unknown", score: 0 };
  for (const entry of entries) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) {
        if (entry.score > best.score) {
          best = { intent: entry.intent, score: entry.score };
        }
      }
    }
  }
  return best;
};

const extractSubTopics = (text = "") => {
  const topics = [];
  const courseMatch = text.match(
    /\b(mca|mba|bca|bba|b\.?com|btech|mtech|bachelor|master)\b/i,
  );
  if (courseMatch?.[0]) {
    topics.push(courseMatch[0].replace(/\./g, "").toUpperCase());
  }
  if (/\b(fee|fees)\b/i.test(text)) topics.push("fees");
  if (/\b(admission|apply)\b/i.test(text)) topics.push("admission");
  if (/\b(eligib)/i.test(text)) topics.push("eligibility");
  return [...new Set(topics)];
};

export const detectUserIntent = ({
  query = "",
  signals = {},
  previousIntent = null,
  collectedData = {},
  turnCount = 0,
} = {}) => {
  const text = cleanText(query);
  if (!text) {
    return {
      intent: previousIntent?.intent || "unknown",
      confidence: previousIntent?.confidence || 0,
      subTopics: previousIntent?.subTopics || [],
      source: "empty",
    };
  }

  if (GREETING_ONLY_RE.test(text) && turnCount <= 1) {
    return {
      intent: "unknown",
      confidence: 0.2,
      subTopics: [],
      source: "greeting",
    };
  }

  if (signals.notInterested) {
    return { intent: "objection", confidence: 0.95, subTopics: ["not_interested"], source: "signal" };
  }

  const appointmentRequested =
    isSchedulingOrBookingRequest(text, collectedData) || isCounselorConnectRequest(text);

  if (appointmentRequested) {
    return {
      intent: "appointment_booking",
      confidence: 0.92,
      subTopics: extractSubTopics(text),
      source: "appointment_signal",
    };
  }

  if (signals.callbackIntent) {
    return { intent: "callback_request", confidence: 0.9, subTopics: [], source: "signal" };
  }

  const patternMatch = scoreFromPatterns(text, INTENT_PATTERNS);
  const label = detectIntentLabel(text);
  const labelIntent = LABEL_TO_INTENT[label] || "unknown";
  const labelScore = labelIntent !== "unknown" ? 0.72 : 0;

  let intent = patternMatch.intent;
  let confidence = patternMatch.score;
  let source = patternMatch.score > 0 ? "pattern" : "baseline";

  if (labelScore > confidence) {
    intent = labelIntent;
    confidence = labelScore;
    source = "label";
  }

  if (collectedData.appointmentRequested && confidence < 0.85) {
    intent = "appointment_booking";
    confidence = Math.max(confidence, 0.86);
    source = "collected_data";
  }

  if (collectedData.interest === "fees" && intent === "unknown") {
    intent = "fee_inquiry";
    confidence = 0.8;
    source = "collected_data";
  }

  if (collectedData.interest === "admission" && intent === "unknown") {
    intent = "admission_inquiry";
    confidence = 0.8;
    source = "collected_data";
  }

  if (collectedData.course && intent === "admission_inquiry") {
    confidence = Math.min(1, confidence + 0.06);
  }

  const subTopics = [
    ...new Set([
      ...(previousIntent?.subTopics || []),
      ...extractSubTopics(text),
      collectedData.course ? String(collectedData.course).toUpperCase() : "",
    ].filter(Boolean)),
  ];

  if (intent === "unknown" && subTopics.length > 0) {
    intent = "admission_inquiry";
    confidence = Math.max(confidence, 0.7);
    source = "subtopic";
  }

  return {
    intent,
    confidence: Number(confidence.toFixed(2)),
    subTopics,
    source,
  };
};

const hasCachedLlmIntent = (previousIntent = null) =>
  previousIntent?.source === "llm" &&
  previousIntent?.intent !== "unknown" &&
  Number(previousIntent?.confidence || 0) >= INTENT_CONFIDENCE_THRESHOLD;

const mergeIntentSubTopics = (left = [], right = []) =>
  [...new Set([...(left || []), ...(right || [])].filter(Boolean))];

export const shouldUseLlmIntentFallback = (
  detected = {},
  previousIntent = null,
  { enableLlmFallback = ENABLE_LLM_INTENT_FALLBACK } = {},
) => {
  if (!enableLlmFallback) return false;
  if (Number(detected.confidence || 0) >= INTENT_CONFIDENCE_THRESHOLD) return false;
  if (LLM_INTENT_SKIP_SOURCES.has(detected.source)) return false;
  if (hasCachedLlmIntent(previousIntent)) return false;
  return true;
};

export const resolveUserIntentAsync = async (
  params = {},
  { classifyFn = classifyUserIntentWithLlm, enableLlmFallback = ENABLE_LLM_INTENT_FALLBACK } = {},
) => {
  const detected = detectUserIntent(params);
  const previousIntent = params.previousIntent || null;

  if (hasCachedLlmIntent(previousIntent) && detected.confidence < INTENT_CONFIDENCE_THRESHOLD) {
    return {
      ...previousIntent,
      subTopics: mergeIntentSubTopics(previousIntent.subTopics, detected.subTopics),
      source: "llm",
    };
  }

  if (!enableLlmFallback || !shouldUseLlmIntentFallback(detected, previousIntent, { enableLlmFallback })) {
    return detected;
  }

  try {
    const llmIntent = await classifyFn({
      query: params.query,
      previousIntent,
    });
    if (!llmIntent?.intent || llmIntent.intent === "unknown") {
      return detected;
    }

    if (llmIntent.confidence >= detected.confidence) {
      return {
        intent: llmIntent.intent,
        confidence: llmIntent.confidence,
        subTopics: mergeIntentSubTopics(detected.subTopics, llmIntent.subTopics),
        source: "llm",
      };
    }
  } catch {
    return detected;
  }

  return detected;
};

export const accumulateUserIntent = (previous = null, current = {}) => {
  const prev = previous && typeof previous === "object" ? previous : { intent: "unknown", confidence: 0, subTopics: [] };
  const curr = current && typeof current === "object" ? current : { intent: "unknown", confidence: 0, subTopics: [] };

  if (curr.intent === "unknown" && prev.intent !== "unknown") {
    return {
      ...prev,
      confidence: Math.max(0, Number(prev.confidence) - 0.08),
      subTopics: [...new Set([...(prev.subTopics || []), ...(curr.subTopics || [])])],
      source: prev.source || "accumulated",
    };
  }

  if (curr.confidence >= prev.confidence || prev.intent === "unknown") {
    return {
      intent: curr.intent,
      confidence: curr.confidence,
      subTopics: [...new Set([...(prev.subTopics || []), ...(curr.subTopics || [])])],
      source: curr.source || "accumulated",
    };
  }

  if (curr.intent === prev.intent) {
    return {
      ...prev,
      confidence: Math.min(1, Number(prev.confidence) + 0.05),
      subTopics: [...new Set([...(prev.subTopics || []), ...(curr.subTopics || [])])],
      source: "accumulated",
    };
  }

  return {
    ...prev,
    subTopics: [...new Set([...(prev.subTopics || []), ...(curr.subTopics || [])])],
  };
};

export const isIntentResolved = (userIntent = {}, intentStatus = "") => {
  if (intentStatus === "resolved") return true;
  const intent = userIntent?.intent || "unknown";
  const confidence = Number(userIntent?.confidence || 0);
  return intent !== "unknown" && confidence >= INTENT_CONFIDENCE_THRESHOLD;
};
