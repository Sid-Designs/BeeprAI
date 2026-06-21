import { v4 as uuidv4 } from "uuid";
import Tenant from "../models/tenant.model.js";
import { generateAIResponse, regenerateCompliantVoiceAnswer } from "../services/llm.service.js";
import { getAgentById } from "../services/agent.service.js";
import { retrieveContext, normalizeSpokenCourseTerms } from "../services/kb/retrieval.service.js";
import {
  addMessageToSession,
  getSessionMessages,
  getSessionContext,
  setSessionContext,
  getSessionCallState,
  setSessionCallState,
  setSessionIntent,
  getCachedAnswer,
  cacheSessionAnswer,
  ensureSessionHydrated,
} from "../services/memory.service.js";
import {
  analyzeLeadIntent,
  buildCallPolicy,
  buildOpeningMessage,
  computeGoalDelta,
  computeLeadStatus,
  detectConversationSignals,
  extractLeadDataFromQuery,
  getEndCallDecision,
  getInitialConversationState,
  mergeCollectedData,
  shouldEndAfterRepeatedThanks,
} from "../services/callPolicy.service.js";
import { upsertLeadOutcome } from "../services/leadOutcome.service.js";
import { runPostCallAnalysis } from "../services/postCall/postCallAnalysis.service.js";
import { applyConversationStyle } from "../services/conversationStyle.service.js";
import {
  detectLanguageProfile,
  getInitialLanguageState,
  getLanguageInstruction,
  resolveLanguageConfig,
} from "../services/language.service.js";
import {
  buildObjectionPlaybookReply,
  detectObjectionType,
  getNextBestAction,
  getObjectionGuidance,
} from "../services/guidanceEngine.service.js";
import { scoreConversationQuality } from "../services/qualityScore.service.js";
import { logInfo } from "../utils/logging.util.js";
import { detectRecoveryNeed } from "../services/conversation/recoveryPolicy.service.js";
import { buildCallLearningSnapshot } from "../services/conversationLearning.service.js";
import {
  finalizeOutboundAnswerAsync,
  trimAnswer,
  ensureWarmClosing,
} from "../services/conversation/finalizeOutboundAnswer.service.js";
import {
  accumulateUserIntent,
  resolveUserIntentAsync,
} from "../services/conversation/userIntent.service.js";
import {
  buildBookingReadinessProbe,
  buildClarifyIntentReply,
  buildConversationDirective,
  buildIntentDiscoveryReply,
  buildIntentMenuReply,
  buildIntakeConfirmedReply,
  buildSlotCollectionReply,
  buildBookingDeclinedReply,
} from "../services/conversation/conversationDirector.service.js";
import {
  buildAnythingElsePrompt,
  buildGracefulCloseReply,
  isObjectiveAchieved,
  shouldForceEndCall,
} from "../services/conversation/callClosure.service.js";
import { composeQueryResolutionResponseAsync } from "../services/conversation/queryResolution.service.js";
import { isBookingStage, isBookingAffirmation } from "../services/conversation/bookingFlow.service.js";
import { isGenericValidatorFallback } from "../services/conversation/responseValidator.service.js";
import { resolveVoiceBookingTurn } from "../services/calendar/voiceBookingCalendar.service.js";
import { updateConversationProgress } from "../services/conversation/conversationStage.service.js";
import { buildCallStatePayload } from "../services/conversation/callStateSync.service.js";
import { isSchedulingOrBookingRequest, isCounselorConnectRequest } from "../services/conversation/conversationPlaybook.service.js";
import {
  buildAppointmentConfirmReply,
  buildAppointmentNotFoundReply,
} from "../services/conversation/conversationPlaybook.service.js";
import {
  buildIntentInsight,
  buildIntentTelemetry,
} from "../services/conversation/intentTelemetry.service.js";
import {
  applyInterruptionResumePrefix,
  applyInterruptionContextToState,
  buildInterruptionResumeMeta,
  clearInterruptionFields,
} from "../services/conversation/interruptionResume.service.js";

const LOW_INTENT_QUERY_RE =
  /^(hi|hello|hey|ok|okay|yes|yeah|no|nope|thanks|thank you|hmm|uh|huh)$/i;
const STT_ECHO_FRAGMENT_RE =
  /^(verified|process|next step|eligibility|fees|admission|steps)$/i;
const CLOSE_OFFER_RE =
  /\b(anything else|before we close|wrap up)\b/i;

const hashPick = (items = [], seed = "") => {
  if (!items.length) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return items[Math.abs(hash) % items.length];
};
const buildConfidence = ({ chunks = [], fromMemory = false }) => {
  if (fromMemory) return { source: "memory", confidence: 0.95 };
  const top = Number(chunks?.[0]?.score || 0);
  if (top >= 0.55) return { source: "kb+llm", confidence: 0.9 };
  if (top >= 0.35) return { source: "kb+llm", confidence: 0.75 };
  if (top > 0) return { source: "llm", confidence: 0.62 };
  return { source: "llm", confidence: 0.5 };
};

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const KB_TOP_K = positiveInt(process.env.KB_TOP_K, 2);
const KB_MAX_CANDIDATES = positiveInt(
  process.env.KB_MAX_CANDIDATES,
  String(process.env.VOICE_FAST_MODE || "true").toLowerCase() === "true" ? 20 : 40,
);
const PHONE_INTENT_RE =
  /\b(phone|phone number|number|contact number|reach me|mobile|whatsapp)\b/i;
const ASK_COURSE_RE =
  /\b(what(?:'s| is)? your (?:name and )?which course|which course are you interested|what course are you interested|which program are you interested|what program are you interested)\b/i;
const ASK_PHONE_RE =
  /\b(phone number|contact number|your number|share your number|confirm your number)\b/i;
const CLAIMED_PHONE_CAPTURE_RE =
  /\b(taken note|saved|captured|recorded|noted).*(phone|number)\b/i;
const CALLBACK_TIME_RE =
  /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|morning|afternoon|evening|tonight|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const CALLBACK_EXACT_TIME_RE =
  /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|morning|afternoon|evening|tonight)\b/i;
const CALLBACK_INCOMPLETE_TIME_RE =
  /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\b/i;
const APPOINTMENT_INTENT_RE =
  /\b(book(?:ing)?|schedul(?:e|ing|ed)|set|fix|arrange)\b.*\b(a+p+ointments?|appointments?|meeting|counselling|counseling|counselou?r(?:\s+call)?|call)\b|\b(a+p+ointments?|appointments?)\b|\bscheduling\b.*\b(request|counselou?r|call)\b/i;
const GENERIC_VALIDATOR_FALLBACK_RE =
  /\blet me keep this simple and answer your question directly\b|\blet me answer that directly from what i have verified\b|\bi do not have that exact detail right now\b|\bi do not have that exact verified detail right now\b/i;
const ENABLE_GOAL_DELTA_TRACKING =
  String(process.env.ENABLE_GOAL_DELTA_TRACKING || "true").toLowerCase() === "true";
const ENABLE_KB_CONFIDENCE_GATE =
  String(process.env.ENABLE_KB_CONFIDENCE_GATE || "true").toLowerCase() === "true";
const ENABLE_OBJECTION_PLAYBOOKS =
  String(process.env.ENABLE_OBJECTION_PLAYBOOKS || "true").toLowerCase() === "true";
const KB_CONFIDENCE_MIN = Number.parseFloat(process.env.KB_CONFIDENCE_MIN || "0.55");
const FACTUAL_QUERY_RE =
  /\b(fee|fees|price|pricing|cost|eligib|criteria|requirement|admission|information|process|duration|placement|career|syllabus|scholarship|deadline|tell me|explain|what is|how)\b/i;
const READY_TO_DISCUSS_RE =
  /\b(we can discuss|let'?s discuss|yes we can|yes sure|sure we can|let'?s start|go ahead|yes continue|we can come|can come|available now|good time)\b/i;
const ENABLE_STRUCTURED_MEMORY =
  String(process.env.ENABLE_STRUCTURED_MEMORY || "true").toLowerCase() === "true";
const ENABLE_DYNAMIC_RESPONSE_LENGTH =
  String(process.env.ENABLE_DYNAMIC_RESPONSE_LENGTH || "true").toLowerCase() === "true";
const ENABLE_AB_VARIANTS =
  String(process.env.ENABLE_AB_VARIANTS || "true").toLowerCase() === "true";
const ENABLE_RECOVERY_POLICIES =
  String(process.env.ENABLE_RECOVERY_POLICIES || "true").toLowerCase() === "true";
const ENABLE_INTENT_DIRECTOR =
  String(process.env.ENABLE_INTENT_DIRECTOR || "true").toLowerCase() === "true";
const ENABLE_INTERRUPTION_RESUME =
  String(process.env.ENABLE_INTERRUPTION_RESUME || "true").toLowerCase() === "true";
const ENABLE_COMPLIANCE_GUARDRAILS =
  String(process.env.ENABLE_COMPLIANCE_GUARDRAILS || "true").toLowerCase() === "true";
const ENABLE_COMPLIANCE_REGENERATION =
  String(process.env.ENABLE_COMPLIANCE_REGENERATION || "true").toLowerCase() === "true";
const ENABLE_VOICE_REALISM_LAYER = false; // DISABLED: Unnecessary text manipulation, Sarvam handles all voice aspects
const buildCallbackSchedule = (extractedData = {}, rawQuery = "") => {
  const preferredDate = String(extractedData?.preferred_date || "").trim();
  const preferredTime = String(extractedData?.preferred_time || "").trim();
  const timeline = String(extractedData?.timeline || "").trim();
  const text = [preferredDate, preferredTime, timeline].filter(Boolean).join(" ").trim()
    || String(rawQuery || "").trim();
  return {
    preferredDate,
    preferredTime,
    timeline,
    text: text.slice(0, 120),
  };
};
const buildAppointmentSchedule = (extractedData = {}, rawQuery = "") => {
  const preferredDate = String(extractedData?.preferred_date || "").trim();
  const preferredTime = String(extractedData?.preferred_time || "").trim();
  const timeline = String(extractedData?.timeline || "").trim();
  const text = [preferredDate || timeline, preferredTime].filter(Boolean).join(" ").trim()
    || String(rawQuery || "").trim();
  return {
    preferredDate,
    preferredTime,
    timeline,
    text: text.slice(0, 120),
  };
};
const hasExactCallbackSlot = (query = "", extractedData = {}) => {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return false;
  if (CALLBACK_INCOMPLETE_TIME_RE.test(text)) return false;
  if (String(extractedData?.preferred_time || "").trim()) return true;
  if (CALLBACK_EXACT_TIME_RE.test(text)) return true;
  return false;
};
const hasAppointmentDate = (query = "", extractedData = {}) =>
  Boolean(String(extractedData?.preferred_date || "").trim()) ||
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)|(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|tom+or+ow|tomor+ow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)/i.test(
    String(query || ""),
  );
const hasAppointmentTime = (query = "", extractedData = {}) =>
  Boolean(String(extractedData?.preferred_time || "").trim()) ||
  CALLBACK_EXACT_TIME_RE.test(String(query || ""));

const buildContext = (chunks, maxChars = 2800) => {
  if (!chunks || chunks.length === 0) return "";

  let used = 0;
  const lines = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const item = chunks[i];
    const line = String(item.content || item.text || "").trim();
    if (!line) continue;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }

  return lines.join("\n");
};

const COURSE_LABELS = Object.freeze({
  BCA: "Bachelor of Computer Applications",
  BBA: "Bachelor of Business Administration",
  BCOM: "Bachelor of Commerce",
  BSC: "Bachelor of Science",
  MBA: "Master of Business Administration",
  MMS: "Master of Management Studies",
  PGDM: "Post Graduate Diploma in Management",
  MCA: "Master of Computer Applications",
  MCOM: "Master of Commerce",
  BTECH: "B.Tech",
  MTECH: "M.Tech",
});

const normalizeCourseKey = (course = "") =>
  String(course || "")
    .replace(/[^a-z0-9]+/gi, "")
    .toUpperCase();

const isCourseOnlyTurn = (query = "", extractedData = {}) => {
  const text = String(query || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text || !extractedData?.course) return false;
  if (FACTUAL_QUERY_RE.test(text)) return false;
  if (/\b(process|eligibility|eligible|criteria|documents?|duration|placement|syllabus|fee|fees|price|cost|information|admission|career|tell me|explain)\b/i.test(text)) {
    return false;
  }
  return (
    text.split(" ").filter(Boolean).length <= 8 ||
    /\b(interested|want|take|choose|looking for|planning)\b/i.test(text)
  );
};

const buildCourseCapturedReply = (course = "") => {
  const key = normalizeCourseKey(course);
  const label = COURSE_LABELS[key] || String(course || "").trim();
  if (!label) return "";
  const prefix = key && COURSE_LABELS[key] && key !== label
    ? `${key} is ${label}`
    : label;
  return `Great, noted. ${prefix}. When are you planning to start?`;
};

const ensureValidStage = (state, signals) => {
  if (signals.hardClose || signals.notInterested) return "closing";

  if (state.stage === "opening") {
    return state.greeted ? "intent_discovery" : "opening";
  }
  if (state.stage === "closing") return "closing";
  if (state.leadStatus === "qualified") return "qualification";

  return state.stage || "intent_discovery";
};

const shouldSkipRetrieval = (query = "") => {
  const text = normalizeSpokenCourseTerms(String(query || "").replace(/\s+/g, " ").trim());
  if (!text) return true;

  const hasFactualTopic =
    FACTUAL_QUERY_RE.test(text) ||
    /\b(eligib|admission|process|MCA|MBA|PGDM|fee|fees)\b/i.test(text);

  if (text.length <= 20 && LOW_INTENT_QUERY_RE.test(text) && !hasFactualTopic) return true;

  if (
    text.length <= 90 &&
    /\b(my name is|i am|interested in|phone number|call me)\b/i.test(text) &&
    !hasFactualTopic
  ) {
    return true;
  }

  if (
    text.length <= 25 &&
    /^(yes|yeah|ok|okay|this year)[.!,\s]*$/i.test(text)
  ) {
    return true;
  }

  return false;
};

const buildFallbackResponse = (policy, state) => {
  if (!state.greeted) return buildOpeningMessage(policy);
  if (state.stage === "closing") return "Thank you for your time. I will close this call now.";
  const objective = String(policy?.objective || "").toLowerCase();

  if (objective === "appointment") {
    return "I may not have that exact detail yet, but I can still guide you through available slots and booking steps. Would you like to proceed with scheduling?";
  }
  if (policy.objective === "sales") {
    return "I may not have that exact detail yet, but I can still guide you on options, pricing, and the best next step. What should we focus on first?";
  }
  if (objective === "support") {
    return "I may not have that exact detail yet, but I can still help you resolve this quickly with the right steps. What issue should we handle first?";
  }
  return "I may not have that exact detail yet, but I can still guide you with the most relevant next steps. What would you like to solve first?";
};

const normalizeUserQuery = (text = "") => {
  const normalized = normalizeSpokenCourseTerms(
    String(text || "")
      .replace(/[.,;:!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (!normalized) return "";

  const parts = normalized.split(" ");
  if (parts.length >= 4) {
    const first = parts[0].toLowerCase();
    const fillers = new Set(["ok", "okay", "yeah", "yes", "hello", "hi"]);
    if (fillers.has(first)) {
      return parts.slice(1).join(" ").trim() || normalized;
    }
  }

  return normalized
    .replace(/\bhydration\s+process\b/gi, "admission process")
    .replace(/\badmission\s+hydration\b/gi, "admission process")
    .replace(/\bscheduling\s+of\s+request\b/gi, "scheduling a counselor call")
    .replace(/\bscheduling\s+a?\s*request\b/gi, "scheduling a counselor call")
    .replace(/\bcounsel(?:l)?ing\s+apartment\b/gi, "counseling appointment")
    .replace(/\bcounselling\s+apartment\b/gi, "counselling appointment")
    .replace(/\bbook\s+apartment\b/gi, "book appointment");
};

const getSlotState = (state = {}) => {
  const slotState = state.slotState && typeof state.slotState === "object"
    ? state.slotState
    : {};

  return {
    lastAskedSlot: String(slotState.lastAskedSlot || ""),
    closeConfirmAsked: Boolean(slotState.closeConfirmAsked),
    closeConfirmThanksCount: Number(slotState.closeConfirmThanksCount || 0),
    objectionVariantSeed: Number(slotState.objectionVariantSeed || 0),
  };
};
const buildLowConfidenceKbReply = (query = "", language = "en") => {
  const text = String(query || "").toLowerCase();
  const lang = String(language || "en").toLowerCase();
  if (/\b(eligibil|eligible|criteria|qualification|pātra|पात्र)\b/.test(text)) {
    return hashPick(
      [
        "Eligibility usually depends on your qualifying exam, minimum marks, and course choice. Which program are you considering?",
        "I can help with eligibility — it typically covers education background, entrance scores, and category rules. Which course should I check for?",
      ],
      text,
    );
  }
  if (/\b(admission|steps|process|apply|application|mahiti|baddal|प्रवेश|प्रक्रिया)\b/.test(text)) {
    if (lang === "mr") {
      return "प्रवेश प्रक्रियेत पात्रता, अर्ज, कागदपत्रे आणि समुपदेशन असते. तुम्ही या वर्षी admission साठी बघत आहात का?";
    }
    return hashPick(
      [
        "Admission usually covers eligibility, application form, documents, and counseling. Would you like eligibility details or to schedule a counselor call?",
        "The admission flow typically includes eligibility check, form submission, and counseling. Which part should I explain first?",
        "I can walk you through admission steps: eligibility, application, documents, and counseling. What would you like to start with?",
      ],
      text,
    );
  }
  if (/\b(fee|fees|pricing|cost)\b/.test(text)) {
    return hashPick(
      [
        "Fee details vary by course. Which program are you interested in?",
        "I can help with fee information once I know your course. Are you looking at MCA, MBA, or another program?",
      ],
      text,
    );
  }
  return hashPick(
    [
      "I do not have that exact detail right now. I can help with admission steps, fees, or scheduling a counselor call. Which would you like?",
      "I may not have that specific detail yet. Would you like admission steps, fee guidance, or a counselor appointment?",
    ],
    text,
  );
};
const hashToBucket = (value = "", mod = 2) => {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % Math.max(1, mod);
};
const resolveExperimentVariant = (sessionId = "") => {
  if (!ENABLE_AB_VARIANTS) return "control";
  return hashToBucket(sessionId, 2) === 0 ? "control" : "warmth_plus";
};
const extractStructuredMemoryFromQuery = (query = "") => {
  const text = String(query || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  if (!text) return {};
  const memory = {};
  if (/\b(i|we)\s+(am|are)\s+the\s+(owner|founder|decision maker|manager)\b/.test(lower)) {
    memory.decision_maker = "self";
  } else if (/\b(i need to check with|need approval from|ask my (father|mother|boss|manager|team))\b/.test(lower)) {
    memory.decision_maker = "other";
  }
  if (/\b(expensive|too costly|budget|cheap|afford|high fees)\b/.test(lower)) {
    memory.budget_signal = "price_sensitive";
  }
  const needMatch = text.match(/\b(need|looking for|interested in)\s+([a-z0-9\s]{3,60})/i);
  if (needMatch?.[2]) {
    memory.need = needMatch[2].trim().slice(0, 80);
  }
  const timelineMatch = text.match(/\b(asap|soon|this week|next week|this month|next month)\b/i);
  if (timelineMatch?.[1]) {
    memory.timeline_signal = timelineMatch[1].toLowerCase();
  }
  return memory;
};
const computeResponseStyleProfile = ({ conversationState = {}, analyticsSnapshot = {}, signals = {}, query = "" }) => {
  if (!ENABLE_DYNAMIC_RESPONSE_LENGTH) {
    return { wordBudget: 24, paceHint: "normal", mode: "default" };
  }
  const interruptions = Number(analyticsSnapshot?.interruptions || 0);
  const emotion = String(conversationState?.userEmotion || "").toLowerCase();
  const factual = /\b(fee|fees|price|cost|eligib|admission|process|course|when|date)\b/i.test(query);
  const complex = /\b(compare|difference|explain|walk me through|step by step)\b/i.test(query);

  if (interruptions >= 2 || signals.offTopic) {
    return { wordBudget: 16, paceHint: "brisk", mode: "concise" };
  }
  if (complex || emotion === "confused" || /\b(what do you mean|didn't get|dont understand|not clear)\b/i.test(query)) {
    return { wordBudget: 36, paceHint: "slower", mode: "explain" };
  }
  if (factual && query.split(" ").length <= 12) {
    return { wordBudget: 22, paceHint: "normal", mode: "factual" };
  }
  return { wordBudget: 26, paceHint: "normal", mode: "balanced" };
};

const resolveMissingLeadField = (state = {}) => {
  const data = state.collectedData || {};
  const hasName = Boolean(String(data.name || "").trim());
  const hasCourse = Boolean(String(data.course || data.interest || "").trim());
  const hasTimeline = Boolean(String(data.timeline || data.preferred_date || "").trim());

  if (!hasCourse) return "course";
  if (!hasTimeline) return "timeline";
  if (!hasName) return "name";
  return "";
};

const buildNextQuestionForField = (field) => {
  if (field === "course") {
    return "Which course are you interested in?";
  }
  if (field === "timeline") {
    return "When are you planning to start?";
  }
  if (field === "name") {
    return "Could you share your name, please?";
  }
  return "Could you share one more detail so I can help you better?";
};
const buildProgressKickoffQuestion = (state = {}, policy = {}) => {
  const missingField = resolveMissingLeadField(state);
  if (missingField) return buildNextQuestionForField(missingField);
  const objective = String(policy?.objective || "").toLowerCase();
  if (objective === "appointment_booking") return "Great, what date works best for your appointment?";
  return "Great, what would you like to know first: process, eligibility, or fees?";
};

const enforceNonRepetitiveAnswer = (answer, state = {}) => {
  const text = String(answer || "").trim();
  if (!text) return text;

  const data = state.collectedData || {};
  const hasCourse = Boolean(String(data.course || data.interest || "").trim());

  if (ASK_COURSE_RE.test(text) && hasCourse) {
    const missing = resolveMissingLeadField(state);
    if (missing && missing !== "course") {
      return buildNextQuestionForField(missing);
    }
  }

  if (CLAIMED_PHONE_CAPTURE_RE.test(text) || ASK_PHONE_RE.test(text)) {
    const missing = resolveMissingLeadField(state);
    return missing
      ? buildNextQuestionForField(missing)
      : "Great, I already have your contact from this call. Would you like details on eligibility, fees, or admission steps?";
  }

  const lastPrompt = String(state.lastAssistantPrompt || "").replace(/\s+/g, " ").trim().slice(0, 220);
  if (
    CLOSE_OFFER_RE.test(text) &&
    CLOSE_OFFER_RE.test(lastPrompt)
  ) {
    return hashPick(
      [
        "Let me help you move forward. Would you like admission steps, fee details, or to book a counselor call?",
        "Happy to continue. Should we cover eligibility, fees, or schedule a counselor appointment?",
        "I can still help with admission process, fees, or booking a counselor. What works best for you?",
      ],
      `${state.turnCount || 0}:${text}`,
    );
  }

  const COUNSELOR_OFFER_RE =
    /\b(arrange a counselor call|counselor can walk|A counselor can|समुपदेशक कॉल)\b/i;
  if (COUNSELOR_OFFER_RE.test(lastPrompt) && COUNSELOR_OFFER_RE.test(text)) {
    const lang = String(state.languageState?.dominantLanguage || "en").toLowerCase();
    if (lang === "mr") {
      return "नक्की. समुपदेशक कॉलसाठी कोणती तारीख आणि वेळ सोयीची आहे?";
    }
    if (lang === "hi") {
      return "ठीक है। counselor call के लिए कौन सी तारीख और समय सही रहेगा?";
    }
    return "Sure. What date and time work best for your counselor call?";
  }

  if (
    lastPrompt &&
    lastPrompt.toLowerCase() === text.toLowerCase() &&
    /\b(appointment|detail|share|confirm)\b/i.test(text)
  ) {
    if (data.preferred_date && data.preferred_time && !data.name) {
      return "Could you share your name to confirm the appointment?";
    }
    if (data.preferred_date && data.preferred_time && data.name) {
      const when = [data.preferred_date, data.preferred_time].filter(Boolean).join(" at ");
      return `I have ${when} noted for ${data.name}. Shall I confirm this booking?`;
    }
    return "What date and time should I book the appointment for?";
  }

  if (isGenericValidatorFallback(text) || GENERIC_VALIDATOR_FALLBACK_RE.test(text)) {
    const stalledTurns = Number(state.goalTracker?.stalledTurns || 0);
    if (stalledTurns >= 3) {
      return "I want to keep this brief. Would you like to schedule a counselor call, or should we wrap up for now?";
    }
    if (data.preferred_date || data.preferred_time || data.appointmentRequested) {
      if (data.preferred_date && data.preferred_time && !data.name) {
        return "Could you share your name to confirm the appointment?";
      }
      if (!data.preferred_date && !data.preferred_time) {
        return "Sure, I can help schedule that. What date and time work best for you?";
      }
      if (data.preferred_date && !data.preferred_time) {
        return "Sure, I noted the date. What time works best for the appointment?";
      }
      return "What date and time should I book the appointment for?";
    }
    const missing = resolveMissingLeadField(state);
    if (missing) return buildNextQuestionForField(missing);
    return hashPick(
      [
        "Got it. Would you like admission steps, fee details, or to schedule a counselor call?",
        "Sure. I can help with admission, fees, or booking a counselor. What works best for you?",
        "Happy to help. Should we cover eligibility, fees, or schedule a counselor appointment?",
      ],
      `${state.turnCount || 0}:${lastPrompt}`,
    );
  }

  return text;
};

// Helper: Find a matching answer in session memory for the same user query and context
function findCachedAnswer(sessionId, normalizedQuery, context) {
  const messages = getSessionMessages(sessionId);
  // Look for the last user+assistant pair with the same query and context
  for (let i = messages.length - 2; i >= 0; i -= 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];
    if (
      userMsg &&
      assistantMsg &&
      userMsg.role === "user" &&
      assistantMsg.role === "assistant" &&
      userMsg.content.trim().toLowerCase() === normalizedQuery.trim().toLowerCase() &&
      (!context || getSessionContext(sessionId) === context)
    ) {
      return assistantMsg.content;
    }
  }
  return null;
}

export const handleQuery = async (req, res) => {
  try {
    const {
      tenantId,
      agentId,
      query,
      sessionId: incomingSessionId,
      debug,
      roomName = "",
      callObjective = "",
      callConfig = {},
      eventType = "",
      conversationHistory = [],
      conversationState = {},
      analyticsSnapshot = {},
      languageState: incomingLanguageState = {},
      interruptionContext = null,
    } = req.body;

    const debugLatency =
      String(process.env.DEBUG_LATENCY || "").toLowerCase() === "true";
    const requestStartedAt = Date.now();

    const normalizedQuery = normalizeUserQuery(query || "");
    const isCallConnectedEvent =
      String(eventType || "").toLowerCase() === "call_connected";

    if (!tenantId || !agentId || (!normalizedQuery && !isCallConnectedEvent)) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId, and query are required",
      });
    }

    const sessionId = incomingSessionId || uuidv4();
    await ensureSessionHydrated(sessionId);
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const agent = await getAgentById(tenantId, agentId);
    const agentPrompt = agent.prompt || "You are a helpful assistant.";
    const history = getSessionMessages(sessionId);
    const policy = buildCallPolicy({
      tenant,
      agent,
      roomName,
      callObjective,
      callConfig,
    });
    const languageConfig = resolveLanguageConfig(callConfig || {});
    const baseLanguageState =
      incomingLanguageState && typeof incomingLanguageState === "object" && Object.keys(incomingLanguageState).length
        ? incomingLanguageState
        : getInitialLanguageState(languageConfig);

    let state = getSessionCallState(sessionId) || getInitialConversationState(policy);
    const baseCollectedData =
      state.collectedData && typeof state.collectedData === "object"
        ? state.collectedData
        : {};
    state = {
      ...state,
      collectedData: { ...baseCollectedData },
      slotState: getSlotState(state),
    };
    if (!state.experiment || typeof state.experiment !== "object") {
      state.experiment = { variant: resolveExperimentVariant(sessionId) };
    }
    if (ENABLE_INTERRUPTION_RESUME && interruptionContext) {
      state = applyInterruptionContextToState(state, interruptionContext);
    }
    state = {
      ...state,
      lastUserQuery: normalizedQuery,
    };

    // Opening is controlled by policy and triggered proactively on call connect.
    if (!state.greeted && isCallConnectedEvent) {
      const opening = buildOpeningMessage(policy);
      const openingAnswer = trimAnswer(opening, 320);

      state = {
        ...state,
        greeted: true,
        stage: ENABLE_INTENT_DIRECTOR ? "intent_discovery" : "discovery",
        callStartedAt: Date.now(),
        turnCount: (state.turnCount || 0) + 1,
      };

      addMessageToSession(sessionId, "assistant", openingAnswer);
      setSessionCallState(sessionId, state);

      try {
        const openingTelemetry = {
          goalDelta: "",
          stalledTurns: 0,
          kbGateTriggered: false,
          abVariant: String(state?.experiment?.variant || "control"),
        };
        await upsertLeadOutcome({
          tenantId,
          agentId,
          sessionId,
          roomName: policy.roomName,
          objective: policy.objective,
          stage: state.stage,
          leadStatus: state.leadStatus,
          collectedData: state.collectedData,
          summary: `${policy.objective} call started`,
          endReason: "",
          isClosed: false,
          turnCount: state.turnCount,
          lastUserMessage: "",
          lastAssistantMessage: openingAnswer,
          callbackRequested: Boolean(state.collectedData?.callbackRequested),
          callbackSchedule: state.collectedData?.callbackSchedule || null,
          telemetry: openingTelemetry,
          learning: buildCallLearningSnapshot({
            objective: policy.objective,
            stage: state.stage,
            leadStatus: state.leadStatus,
            collectedData: state.collectedData,
            summary: `${policy.objective} call started`,
            endReason: "",
            isClosed: false,
            turnCount: state.turnCount,
            lastUserMessage: "",
            lastAssistantMessage: openingAnswer,
            callbackRequested: Boolean(state.collectedData?.callbackRequested),
            callbackSchedule: state.collectedData?.callbackSchedule || null,
            telemetry: openingTelemetry,
            qualityScore: 0,
          }),
        });
      } catch (error) {
        console.warn("[lead] outcome upsert failed:", error.message);
      }

      return res.status(200).json({
        success: true,
        sessionId,
        answer: openingAnswer,
        responseLanguage: languageConfig.startLanguage,
        languageState: baseLanguageState,
        endCall: false,
        leadStatus: state.leadStatus,
        stage: state.stage,
        objective: policy.objective,
        contextUsed: "",
        agent: agent._id,
        directiveAction: "opening_greeting",
        answerSource: "template",
      });
    }

    if (isCallConnectedEvent) {
      return res.status(200).json({
        success: true,
        sessionId,
        answer: "",
        responseLanguage: languageConfig.startLanguage,
        languageState: baseLanguageState,
        endCall: false,
        leadStatus: state.leadStatus,
        stage: state.stage,
        objective: policy.objective,
        contextUsed: "",
        agent: agent._id,
      });
    }

    const needsFirstTurnGreeting = !state.greeted;

    if (needsFirstTurnGreeting) {
      state = {
        ...state,
        stage: "opening",
      };
    }

    let turnDirective = state.turnDirective || null;

    const buildTurnTelemetry = ({
      goalDelta = "",
      stalledTurns = 0,
      kbGateTriggered = false,
      responseStyle = responseStyleProfile,
      extra = {},
    } = {}) => ({
      ...buildIntentTelemetry({ state, turnDirective, extra }),
      goalDelta: String(goalDelta || ""),
      stalledTurns: Number(stalledTurns || 0),
      kbGateTriggered: Boolean(kbGateTriggered),
      responseStyleMode: String(responseStyle?.mode || ""),
      responseWordBudget: Number(responseStyle?.wordBudget || 0),
      abVariant: String(state?.experiment?.variant || "control"),
    });

    const saveTurnAndRespond = async ({
      answer,
      nextState,
      endCall = false,
      endReason = "",
      contextUsed = "",
      stage = "",
      languageState = baseLanguageState,
      telemetry = {},
    }) => {
      const safeState = nextState || state;
      const resolvedStage = stage || safeState.stage || "discovery";
      const forceEnd = shouldForceEndCall({
        stage: resolvedStage,
        endCall: endCall || safeState.endCall,
      });
      const resolvedEndReason =
        endReason ||
        safeState.endReason ||
        (forceEnd ? "conversation_closed" : "");
      const intentInsight = buildIntentInsight({ state: safeState, turnDirective });
      const progress = updateConversationProgress({
        previousState: state,
        nextStage: resolvedStage,
        collectedData: safeState.collectedData,
        userIntent: safeState.userIntent,
        directiveAction: turnDirective?.action || "",
      });
      const trustedTemplate =
        Boolean(telemetry?.appointmentRequested) ||
        Boolean(telemetry?.appointmentConfirmed) ||
        Boolean(telemetry?.appointmentReady) ||
        isBookingStage(resolvedStage) ||
        ["appointment_booking", "complete_booking", "confirm_appointment", "callback"].includes(
          turnDirective?.action || "",
        );
      const skipVoicePolish =
        trustedTemplate ||
        ["llm_kb", "llm_kb_low_conf", "llm_kb_fallback", "template"].includes(
          String(telemetry?.kbAnswerSource || ""),
        );
      let styledAnswer = applyConversationStyle({
        answer: enforceNonRepetitiveAnswer(answer, safeState),
        userEmotion: conversationState?.userEmotion || "neutral",
        stage: resolvedStage,
        turnCount: safeState.turnCount || 0,
        query: normalizedQuery,
        previousAiMessage: getSessionMessages(sessionId).slice(-1)[0]?.content || "",
        responseStyleProfile,
        skipPolish: skipVoicePolish,
      });
      if (forceEnd || (String(resolvedStage).toLowerCase() === "closing" && endCall)) {
        styledAnswer = ensureWarmClosing(styledAnswer);
      }
      const previousAiMessage = getSessionMessages(sessionId).slice(-1)[0]?.content || "";
      const regenerateAnswer =
        ENABLE_COMPLIANCE_REGENERATION && telemetry?.kbAnswerSource === "llm_kb"
          ? regenerateCompliantVoiceAnswer
          : null;
      const finalized = await finalizeOutboundAnswerAsync({
        answer: styledAnswer,
        query: normalizedQuery,
        knowledge: contextUsed || getSessionContext(sessionId) || "",
        stage: resolvedStage,
        isOpeningTurn: String(resolvedStage).toLowerCase() === "opening",
        previousAiMessage,
        responseStyleProfile,
        enableCompliance: ENABLE_COMPLIANCE_GUARDRAILS,
        enableVoiceRealism: ENABLE_VOICE_REALISM_LAYER,
        regenerateAnswer,
        enableComplianceRetry: ENABLE_COMPLIANCE_REGENERATION,
        trustedTemplate,
      });
      if (!finalized.compliance.compliant) {
        logInfo("[telemetry] compliance_blocked", {
          sessionId,
          reason: finalized.compliance.reason,
          complianceRetried: finalized.complianceRetried,
          complianceRecovered: finalized.complianceRecovered,
        });
      }
      const finalAnswer = ENABLE_INTERRUPTION_RESUME
        ? applyInterruptionResumePrefix(
            finalized.answer,
            turnDirective?.interruptionResume || {},
          )
        : finalized.answer;
      const qualityScore = scoreConversationQuality({
        answer: finalAnswer,
        conversationState,
        analyticsSnapshot,
      });
      const nextStateWithProgress = clearInterruptionFields({
        ...safeState,
        goalTracker: progress.goalTracker,
        lastAssistantPrompt: finalAnswer,
      });

      addMessageToSession(sessionId, "user", normalizedQuery);
      addMessageToSession(sessionId, "assistant", finalAnswer);
      setSessionContext(sessionId, contextUsed || "");
      setSessionCallState(sessionId, nextStateWithProgress);

      const turnTelemetry = buildTurnTelemetry({
        goalDelta: nextStateWithProgress?.goalTracker?.lastDelta,
        stalledTurns: nextStateWithProgress?.goalTracker?.stalledTurns,
        extra: telemetry || {},
      });
      void upsertLeadOutcome({
          tenantId,
          agentId,
          sessionId,
          roomName: policy.roomName,
          objective: policy.objective,
          stage: resolvedStage,
          leadStatus: nextStateWithProgress.leadStatus,
          collectedData: nextStateWithProgress.collectedData,
          summary: `${policy.objective} stage=${resolvedStage}`,
          endReason: resolvedEndReason,
          isClosed: forceEnd,
          turnCount: nextStateWithProgress.turnCount,
          lastUserMessage: normalizedQuery,
          lastAssistantMessage: finalAnswer,
          callbackRequested: Boolean(nextStateWithProgress.collectedData?.callbackRequested),
          callbackSchedule: nextStateWithProgress.collectedData?.callbackSchedule || null,
          telemetry: turnTelemetry,
          intentInsight,
          learning: buildCallLearningSnapshot({
            objective: policy.objective,
            stage: resolvedStage,
            leadStatus: nextStateWithProgress.leadStatus,
            collectedData: nextStateWithProgress.collectedData,
            summary: `${policy.objective} stage=${resolvedStage}`,
            endReason: resolvedEndReason,
            isClosed: forceEnd,
            turnCount: nextStateWithProgress.turnCount,
            lastUserMessage: normalizedQuery,
            lastAssistantMessage: finalAnswer,
            callbackRequested: Boolean(nextStateWithProgress.collectedData?.callbackRequested),
            callbackSchedule: nextStateWithProgress.collectedData?.callbackSchedule || null,
            telemetry: turnTelemetry,
            intentInsight,
            qualityScore,
          }),
        }).catch((error) => {
          console.warn("[lead] outcome upsert failed:", error.message);
        });

      if (forceEnd) {
        void runPostCallAnalysis({
          sessionId,
          callId: sessionId,
          roomName: policy.roomName,
          tenantId,
          agentId,
          endReason: resolvedEndReason,
          triggerSource: "ai_controller",
          objective: policy.objective,
          callState: nextStateWithProgress,
          intentInsight,
        }).catch((error) => {
          console.warn("[post-call] controller finalize failed:", error.message);
        });
      }

      return res.status(200).json({
        success: true,
        sessionId,
        answer: finalAnswer,
        responseLanguage: languageState?.dominantLanguage || languageConfig.startLanguage,
        languageState,
        endCall: forceEnd,
        endReason: resolvedEndReason,
        leadStatus: nextStateWithProgress.leadStatus,
        stage: resolvedStage,
        objective: policy.objective,
        contextUsed: contextUsed || "",
        agent: agent._id,
        qualityScore,
        userIntent: nextStateWithProgress.userIntent || null,
        intentStatus: nextStateWithProgress.intentStatus || "pending",
        intentResolutionMs: nextStateWithProgress.intentResolutionMs || null,
        bookingReadiness: nextStateWithProgress.bookingReadiness || "not_asked",
        returnStage: nextStateWithProgress.returnStage || null,
        directiveAction: turnDirective?.action || "",
        objectiveAchieved: Boolean(nextStateWithProgress.objectiveAchieved),
        collectedData: buildCallStatePayload(nextStateWithProgress).collectedData,
        goalDelta: nextStateWithProgress?.goalTracker?.lastDelta || "",
        stalledTurns: Number(nextStateWithProgress?.goalTracker?.stalledTurns || 0),
        answerSource:
          telemetry?.kbAnswerSource ||
          (turnDirective?.skipLLM ? "intent_director" : "template"),
        answerConfidence: Number(
          safeState.userIntent?.confidence ||
            telemetry?.retrievalConfidence ||
            (turnDirective?.skipLLM ? 0.85 : 0),
        ),
        interruptedUtterance: "",
        activeTopic: "",
        interruptionPending: false,
      });
    };

    const signals = detectConversationSignals(normalizedQuery);
    const responseStyleProfile = computeResponseStyleProfile({
      conversationState,
      analyticsSnapshot,
      signals,
      query: normalizedQuery,
    });
    const turnLanguageState = detectLanguageProfile({
      query: normalizedQuery,
      previousState: baseLanguageState,
      languageConfig,
    });
    const languageInstruction = getLanguageInstruction({
      languageState: turnLanguageState,
      languageConfig,
      conversationState,
    });
    const extractedData = extractLeadDataFromQuery(normalizedQuery);
    const structuredMemory = ENABLE_STRUCTURED_MEMORY
      ? extractStructuredMemoryFromQuery(normalizedQuery)
      : {};
    const intentProfile = analyzeLeadIntent({
      query: normalizedQuery,
      signals,
      collectedData: {
        ...(state.collectedData || {}),
        ...extractedData,
        ...structuredMemory,
      },
    });

    state = {
      ...state,
      collectedData: mergeCollectedData(state.collectedData, {
        ...extractedData,
        ...structuredMemory,
      }),
    };

    const slotState = getSlotState(state);
    if (slotState.closeConfirmAsked && signals.closeConfirmationAffirmed) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "closing",
        endCall: true,
        endReason: "user_confirmed_closing",
        leadStatus: state.leadStatus === "new" ? "closed" : state.leadStatus,
      };
      return saveTurnAndRespond({
        answer: "Understood. I will close the call now. Goodbye, take care.",
        nextState,
        endCall: true,
        endReason: "user_confirmed_closing",
        stage: "closing",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    if (signals.hardClose) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "closing",
        endCall: true,
        endReason: "user_requested_end",
        leadStatus: state.leadStatus === "new" ? "closed" : state.leadStatus,
      };
      return saveTurnAndRespond({
        answer: "Understood. I will close the call now. Goodbye, take care.",
        nextState,
        endCall: true,
        endReason: "user_requested_end",
        stage: "closing",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    const SOFT_CLOSE_RE =
      /^(no thanks|no thank you|that(?:'s| is) all|thats all|nothing else|no more questions|all good|we are done|i am done)\b/i;
    const LEAVING_RE = /\b(i will go|i'll go|i have to go|have to go|gotta go|need to go)\b/i;
    if (
      state.closeOffered &&
      (SOFT_CLOSE_RE.test(normalizedQuery) || signals.gratitudeClose || LEAVING_RE.test(normalizedQuery))
    ) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "closing",
        endCall: true,
        endReason: "user_confirmed_closing",
        leadStatus: state.leadStatus === "new" ? "closed" : state.leadStatus,
      };
      return saveTurnAndRespond({
        answer: buildGracefulCloseReply({
          language: turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
          reason: "user_confirmed_closing",
          orgName: policy.orgName,
        }),
        nextState,
        endCall: true,
        endReason: "user_confirmed_closing",
        stage: "closing",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    if (signals.notInterested && !state.closeOffered) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "closing",
        endCall: true,
        endReason: "user_not_interested",
        leadStatus: "not_interested",
      };
      return saveTurnAndRespond({
        answer: "Understood. I will not continue this call. Goodbye, take care.",
        nextState,
        endCall: true,
        endReason: "user_not_interested",
        stage: "closing",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    if (LEAVING_RE.test(normalizedQuery) && !signals.interest) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "closing",
        endCall: true,
        endReason: "user_requested_end",
      };
      return saveTurnAndRespond({
        answer: "Sure. Thank you for your time. Goodbye, take care.",
        nextState,
        endCall: true,
        endReason: "user_requested_end",
        stage: "closing",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    const POST_GREETING_ACK_RE = /^(yes|yeah|yep|sure|ok|okay|alright|haan|ho|go ahead)[?.!,\s]*$/i;

    if (STT_ECHO_FRAGMENT_RE.test(normalizedQuery)) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: state.stage || "qualification",
      };
      return saveTurnAndRespond({
        answer: buildLowConfidenceKbReply("admission steps"),
        nextState,
        stage: "query_resolution",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
        telemetry: { sttEchoRecovery: true },
      });
    }

    if (
      state.greeted &&
      POST_GREETING_ACK_RE.test(normalizedQuery.trim()) &&
      (state.turnCount || 0) <= 2 &&
      !state.intentStatus
    ) {
      const nextState = {
        ...state,
        greeted: true,
        intentStatus: "resolved",
        turnCount: (state.turnCount || 0) + 1,
        stage: "qualification",
        bookingReadiness: "probing",
      };
      return saveTurnAndRespond({
        answer: buildIntentMenuReply({
          collectedData: state.collectedData,
          userIntent: state.userIntent || { intent: "information_request" },
          language: turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
        }),
        nextState,
        stage: "qualification",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    if (ENABLE_INTENT_DIRECTOR) {
      if (
        String(state.stage || "").toLowerCase() === "confirmation" ||
        /\b(shall i confirm|confirm this booking)\b/i.test(String(state.lastAssistantPrompt || ""))
      ) {
        if (isBookingAffirmation(normalizedQuery)) {
        const responseLanguage =
          turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en";
        const bookingResult = await resolveVoiceBookingTurn({
          tenantId,
          sessionId,
          customerPhone: String(state.collectedData?.phone || state.collectedData?.phoneNumber || ""),
          state,
          extractedData,
          query: normalizedQuery,
          policy,
          language: responseLanguage,
          intentProfile: analyzeLeadIntent({
            query: normalizedQuery,
            signals,
            collectedData: mergeCollectedData(state.collectedData, extractedData),
          }),
          mergeCollectedDataFn: mergeCollectedData,
        });
        return saveTurnAndRespond({
          answer: bookingResult.answer,
          nextState: bookingResult.nextState,
          endCall: bookingResult.endCall,
          endReason: bookingResult.endReason,
          stage: bookingResult.stage,
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: buildIntentTelemetry({
            state: bookingResult.nextState,
            turnDirective: { action: "complete_booking" },
          }),
        });
        }
      }

      const detectedIntent = await resolveUserIntentAsync({
        query: normalizedQuery,
        signals,
        previousIntent: state.userIntent,
        collectedData: {
          ...(state.collectedData || {}),
          ...extractedData,
          ...structuredMemory,
        },
        turnCount: state.turnCount || 0,
      });
      const userIntent = accumulateUserIntent(state.userIntent, detectedIntent);

      state = {
        ...state,
        userIntent,
      };
      setSessionIntent(sessionId, userIntent.intent);

      const priorUserMessages = history
        .filter((message) => message.role === "user")
        .map((message) => normalizeUserQuery(message.content || ""));
      const lastPriorUser = priorUserMessages[priorUserMessages.length - 1] || "";
      if (
        lastPriorUser &&
        lastPriorUser.toLowerCase() === normalizedQuery.toLowerCase() &&
        state.lastAssistantPrompt
      ) {
        const repeatLang =
          turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en";
        const repeatAnswer =
          repeatLang === "mr"
            ? "मी ऐकतो आहे. admission, fees किंवा counselor call — पुढे काय हवं?"
            : repeatLang === "hi"
              ? "मैं सुन रहा हूँ। admission, fees या counselor call — आगे क्या चाहिए?"
              : "I heard you. Would you like admission steps, fee details, or to schedule a counselor call?";
        return saveTurnAndRespond({
          answer: repeatAnswer,
          nextState: {
            ...state,
            greeted: true,
            turnCount: (state.turnCount || 0) + 1,
          },
          stage: state.stage || "qualification",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: { duplicateUserTurn: true },
        });
      }

      turnDirective = buildConversationDirective({
        policy,
        state,
        userIntent,
        signals,
        query: normalizedQuery,
        extractedData,
        intentProfile,
      });
      state.turnDirective = turnDirective;
      if (turnDirective.bookingReadiness) {
        state.bookingReadiness = turnDirective.bookingReadiness;
      }
      if (turnDirective.returnStage) {
        state.returnStage = turnDirective.returnStage;
      }

      const responseLanguage =
        turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en";

      const intentTelemetry = {
        userIntent,
        intentResolutionMs: state.intentResolutionMs,
        intentResolvedAtTurn: state.intentResolvedAtTurn,
        directiveAction: turnDirective.action,
      };

      if (turnDirective.action === "intent_discovery_reply") {
        const answer = buildIntentDiscoveryReply({
          userIntent,
          collectedData: mergeCollectedData(state.collectedData, extractedData),
          policy,
          language: responseLanguage,
        });
        if (answer) {
          const intentResolutionMs = state.callStartedAt
            ? Date.now() - Number(state.callStartedAt)
            : null;
          const nextState = {
            ...state,
            greeted: true,
            intentStatus: "resolved",
            intentResolvedAtTurn: (state.turnCount || 0) + 1,
            intentResolutionMs,
            turnCount: (state.turnCount || 0) + 1,
            stage: "intent_discovery",
          };
          logInfo("[intent] resolved", {
            sessionId,
            intent: userIntent.intent,
            confidence: userIntent.confidence,
            intentResolutionMs,
            turn: nextState.intentResolvedAtTurn,
          });
          return saveTurnAndRespond({
            answer,
            nextState,
            stage: "intent_discovery",
            contextUsed: getSessionContext(sessionId) || "",
            languageState: turnLanguageState,
            telemetry: intentTelemetry,
          });
        }
      }

      if (turnDirective.action === "clarify_intent") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "intent_discovery",
        };
        return saveTurnAndRespond({
          answer: buildClarifyIntentReply({ policy, language: responseLanguage }),
          nextState,
          stage: "intent_discovery",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "intent_menu") {
        const nextState = {
          ...state,
          greeted: true,
          intentStatus: "resolved",
          turnCount: (state.turnCount || 0) + 1,
          stage: "qualification",
          bookingReadiness: turnDirective.bookingReadiness || "probing",
          intentMenuOffered: true,
        };
        return saveTurnAndRespond({
          answer: buildIntentMenuReply({
            collectedData: mergeCollectedData(state.collectedData, extractedData),
            userIntent,
            language: responseLanguage,
          }),
          nextState,
          stage: "qualification",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "intake_confirmed") {
        const mergedCollected = mergeCollectedData(state.collectedData, {
          ...extractedData,
          timeline: "this_year",
          intake_year: "current",
        });
        const nextState = {
          ...state,
          greeted: true,
          intentStatus: "resolved",
          turnCount: (state.turnCount || 0) + 1,
          stage: "qualification",
          bookingReadiness: turnDirective.bookingReadiness || "not_asked",
          closeOffered: false,
          collectedData: mergedCollected,
        };
        return saveTurnAndRespond({
          answer: buildIntakeConfirmedReply({
            collectedData: mergedCollected,
            userIntent,
            language: responseLanguage,
          }),
          nextState,
          stage: "qualification",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "collect_slot" && turnDirective.nextSlot) {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "information_collection",
          pendingSlot: turnDirective.nextSlot,
        };
        return saveTurnAndRespond({
          answer: buildSlotCollectionReply(turnDirective.nextSlot),
          nextState,
          stage: "information_collection",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "probe_booking_readiness") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "booking_readiness",
          bookingReadiness: "probing",
          returnStage: state.stage || "qualification",
        };
        return saveTurnAndRespond({
          answer: buildBookingReadinessProbe({ language: responseLanguage }),
          nextState,
          stage: "booking_readiness",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "booking_declined") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: turnDirective.stage || "qualification",
          bookingReadiness: "declined",
          returnStage: null,
        };
        return saveTurnAndRespond({
          answer: buildBookingDeclinedReply({ language: responseLanguage }),
          nextState,
          stage: nextState.stage,
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "offer_close") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: state.stage || "qualification",
          closeOffered: true,
        };
        return saveTurnAndRespond({
          answer: buildAnythingElsePrompt({
            language: responseLanguage,
            turnCount: nextState.turnCount,
          }),
          nextState,
          stage: nextState.stage,
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "graceful_close") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "closing",
          closeOffered: true,
          endCall: true,
          endReason: turnDirective.endReason || "conversation_closed",
        };
        return saveTurnAndRespond({
          answer: buildGracefulCloseReply({
            language: responseLanguage,
            reason: turnDirective.endReason,
            orgName: policy.orgName,
          }),
          nextState,
          endCall: true,
          endReason: turnDirective.endReason || "conversation_closed",
          stage: "closing",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: intentTelemetry,
        });
      }

      if (turnDirective.action === "confirm_appointment") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "confirmation",
        };
        return saveTurnAndRespond({
          answer: buildAppointmentConfirmReply({
            collectedData: mergeCollectedData(state.collectedData, extractedData),
            language: responseLanguage,
          }),
          nextState,
          stage: "confirmation",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: { ...intentTelemetry, expectedOutcome: turnDirective.expectedOutcome },
        });
      }

      if (turnDirective.action === "appointment_not_found") {
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "qualification",
          bookingReadiness: "not_asked",
        };
        return saveTurnAndRespond({
          answer: buildAppointmentNotFoundReply({ language: responseLanguage }),
          nextState,
          stage: "qualification",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: { ...intentTelemetry, expectedOutcome: turnDirective.expectedOutcome },
        });
      }

      if (turnDirective.action === "handle_objection") {
        const objection = detectObjectionType(normalizedQuery);
        const nextState = {
          ...state,
          greeted: true,
          turnCount: (state.turnCount || 0) + 1,
          stage: "objection_handling",
          returnStage: turnDirective.returnStage || state.stage,
        };
        const objectionAnswer = buildObjectionPlaybookReply({
          objection,
          language: responseLanguage,
          variantSeed: state.turnCount || 0,
        });
        return saveTurnAndRespond({
          answer: objectionAnswer || getObjectionGuidance(objection, responseLanguage),
          nextState,
          stage: "objection_handling",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: { ...intentTelemetry, objection, expectedOutcome: turnDirective.expectedOutcome },
        });
      }

      if (
        turnDirective.action === "appointment_booking" ||
        turnDirective.action === "complete_booking"
      ) {
        const bookingResult = await resolveVoiceBookingTurn({
          tenantId,
          sessionId,
          customerPhone: String(state.collectedData?.phone || state.collectedData?.phoneNumber || ""),
          state,
          extractedData,
          query: normalizedQuery,
          policy,
          language: responseLanguage,
          intentProfile,
          mergeCollectedDataFn: mergeCollectedData,
        });
        return saveTurnAndRespond({
          answer: bookingResult.answer,
          nextState: bookingResult.nextState,
          endCall: bookingResult.endCall,
          endReason: bookingResult.endReason,
          stage: bookingResult.stage,
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: {
            ...buildIntentTelemetry({ state: bookingResult.nextState, turnDirective }),
            ...(bookingResult.telemetry || {}),
          },
        });
      }
    }

    const nextBestAction = getNextBestAction({
      query: normalizedQuery,
      state,
      conversationState,
      userIntent: state.userIntent,
    });
    const objectionGuidance = getObjectionGuidance(
      nextBestAction.objection,
      languageInstruction.responseLanguage,
    );
    const hasConcreteCallbackTime = hasExactCallbackSlot(normalizedQuery, extractedData);

    const hasPhoneIntent = PHONE_INTENT_RE.test(normalizedQuery);
    if (ENABLE_RECOVERY_POLICIES) {
      const recovery = detectRecoveryNeed({
        query: normalizedQuery,
        state,
        currentIntent: String(state.userIntent?.intent || ""),
      });
      if (recovery.recoveryType && recovery.suggestedReply) {
        const recoveryState = {
          ...state,
          turnCount: (state.turnCount || 0) + 1,
          stage: "discovery",
        };
        return saveTurnAndRespond({
          answer: recovery.suggestedReply,
          nextState: recoveryState,
          stage: "discovery",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: { recoveryType: recovery.recoveryType },
        });
      }
    }

    if (
      READY_TO_DISCUSS_RE.test(normalizedQuery) &&
      !signals.hardClose &&
      !signals.notInterested
    ) {
      const menuAlreadyOffered =
        Boolean(state.intentMenuOffered) ||
        /\b(eligibility|fees|admission steps|know first|what would you like)\b/i.test(
          String(state.lastAssistantPrompt || ""),
        );
      if (menuAlreadyOffered) {
        const nextState = {
          ...state,
          turnCount: (state.turnCount || 0) + 1,
          stage: state.stage || "qualification",
        };
        return saveTurnAndRespond({
          answer:
            "Sure — what would you like to know first: eligibility, fees, or admission steps?",
          nextState,
          stage: nextState.stage,
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
          telemetry: { readinessAck: true },
        });
      }
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "discovery",
      };
      return saveTurnAndRespond({
        answer: buildProgressKickoffQuestion(nextState, policy),
        nextState,
        stage: "discovery",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
        telemetry: { readinessKickoff: true },
      });
    }

    if (
      LOW_INTENT_QUERY_RE.test(normalizedQuery) &&
      !signals.hardClose &&
      !signals.notInterested &&
      !signals.callbackIntent &&
      !hasPhoneIntent
    ) {
      const missingField = resolveMissingLeadField(state);
      if (missingField) {
        const nextState = {
          ...state,
          turnCount: (state.turnCount || 0) + 1,
          slotState: {
            ...slotState,
            lastAskedSlot: missingField,
          },
        };

        return saveTurnAndRespond({
          answer: buildNextQuestionForField(missingField),
          nextState,
          stage: "discovery",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
        });
      }
    }

    if (signals.shouldConfirmClose) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "closing",
        slotState: {
          ...slotState,
          closeConfirmAsked: true,
        },
      };
      return saveTurnAndRespond({
        answer: "Just to confirm, are you ending the call?",
        nextState,
        endCall: false,
        stage: "closing",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
        telemetry: {
          closeConfirmationRequested: true,
          closeSignalConfidence: signals.closeConsentConfidence,
        },
      });
    }

    const appointmentPending =
      String(state.stage || "").toLowerCase() === "appointment" ||
      String(state.stage || "").toLowerCase() === "appointment_booking" ||
      String(state.stage || "").toLowerCase() === "confirmation";
    const appointmentIntent =
      isCounselorConnectRequest(normalizedQuery) ||
      isSchedulingOrBookingRequest(normalizedQuery, mergeCollectedData(state.collectedData, extractedData)) ||
      APPOINTMENT_INTENT_RE.test(normalizedQuery) ||
      Boolean(extractedData.appointmentRequested) ||
      Boolean(state.collectedData?.appointmentRequested) ||
      (ENABLE_INTENT_DIRECTOR && turnDirective?.action === "appointment_booking") ||
      (ENABLE_INTENT_DIRECTOR && turnDirective?.action === "complete_booking") ||
      (ENABLE_INTENT_DIRECTOR && state.bookingReadiness === "ready") ||
      (ENABLE_INTENT_DIRECTOR && isBookingStage(state.stage));
    if (appointmentIntent || appointmentPending) {
      const bookingResult = await resolveVoiceBookingTurn({
        tenantId,
        sessionId,
        customerPhone: String(state.collectedData?.phone || state.collectedData?.phoneNumber || ""),
        state,
        extractedData,
        query: normalizedQuery,
        policy,
        language: turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
        intentProfile,
        mergeCollectedDataFn: mergeCollectedData,
      });
      return saveTurnAndRespond({
        answer: bookingResult.answer,
        nextState: bookingResult.nextState,
        endCall: bookingResult.endCall,
        endReason: bookingResult.endReason,
        stage: bookingResult.stage,
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
        telemetry: {
          ...buildIntentTelemetry({ state: bookingResult.nextState, turnDirective }),
          ...(bookingResult.telemetry || {}),
        },
      });
    }

    const callbackPending = String(state.stage || "").toLowerCase() === "callback";
    if (!appointmentIntent && !appointmentPending && (signals.callbackIntent || callbackPending)) {
      const callbackSchedule = buildCallbackSchedule(extractedData, normalizedQuery);
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        collectedData: mergeCollectedData(state.collectedData, {
          ...extractedData,
          callbackRequested: true,
          callbackSchedule,
        }),
        stage: hasConcreteCallbackTime ? "closing" : "callback",
        leadStatus: state.leadStatus === "new" ? "interested" : state.leadStatus,
      };

      if (!hasConcreteCallbackTime) {
        const hasDateOnly =
          Boolean(extractedData.preferred_date) ||
          /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
            normalizedQuery,
          );
        return saveTurnAndRespond({
          answer: hasDateOnly
            ? "Sure. I noted the day. What exact time should I call you?"
            : "Sure, I can call you later. What exact time should I call you back?",
          nextState,
          stage: "callback",
          contextUsed: getSessionContext(sessionId) || "",
          languageState: turnLanguageState,
        });
      }

      const slot =
        callbackSchedule.text ||
        "that time";

      return saveTurnAndRespond({
        answer: `Perfect, I noted ${slot}. I will call you back then. Thank you, goodbye.`,
        nextState: {
          ...nextState,
          endCall: true,
          endReason: "user_requested_callback",
          stage: "completed",
          objectiveAchieved: true,
          objectiveAchievedReason: "callback_scheduled",
          leadStatus: "qualified",
        },
        endCall: true,
        endReason: "user_requested_callback",
        stage: "completed",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    if (hasPhoneIntent) {
      const nextState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
      };

      const missingField = resolveMissingLeadField(nextState);
      const answer = missingField
        ? `I already have your contact from this call. ${buildNextQuestionForField(missingField)}`
        : "I already have your contact from this call. Would you like details on eligibility, fees, or admission steps?";

      return saveTurnAndRespond({
        answer,
        nextState,
        stage: "discovery",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
      });
    }

    const mergedData = mergeCollectedData(state.collectedData, {
      ...extractedData,
      ...structuredMemory,
    });
    const leadStatus = computeLeadStatus({
      currentStatus: state.leadStatus,
      signals,
      collectedData: mergedData,
      intentProfile,
      objective: policy.objective,
    });

    state = {
      ...state,
      turnCount: (state.turnCount || 0) + 1,
      collectedData: mergedData,
      leadStatus,
      intentProfile,
    };

    if (
      isCourseOnlyTurn(normalizedQuery, extractedData) &&
      turnDirective?.action !== "answer_then_steer"
    ) {
      const courseState = {
        ...state,
        greeted: true,
        stage: "discovery",
        slotState: {
          ...slotState,
          lastAskedSlot: "timeline",
        },
      };
      return saveTurnAndRespond({
        answer: buildCourseCapturedReply(extractedData.course),
        nextState: courseState,
        stage: "discovery",
        contextUsed: getSessionContext(sessionId) || "",
        languageState: turnLanguageState,
        telemetry: {
          courseCapturedFastPath: true,
          intentScore: intentProfile.commitmentScore,
        },
      });
    }

    const retrievalStartedAt = Date.now();
    let chunks = [];

    if (!shouldSkipRetrieval(normalizedQuery)) {
      chunks = await retrieveContext(normalizedQuery, tenantId, agentId, {
        topK: KB_TOP_K,
        minScore: KB_CONFIDENCE_MIN,
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        maxCandidates: KB_MAX_CANDIDATES,
        courseHint: String(state.collectedData?.course || "").trim(),
      });
    }

    const retrievalEndedAt = Date.now();


    let context = buildContext(chunks, 3800);
    if (!context) {
      context = getSessionContext(sessionId);
    }
    const retrievalConfidence = buildConfidence({ chunks, fromMemory: false }).confidence;

    if (ENABLE_INTENT_DIRECTOR && turnDirective?.action === "answer_then_steer") {
      const qrState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "query_resolution",
        returnStage: turnDirective.returnStage || "qualification",
        bookingReadiness: state.bookingReadiness || "probing",
      };
      const qrResult = await composeQueryResolutionResponseAsync({
        kbContext: context,
        query: normalizedQuery,
        userIntent: state.userIntent,
        policy,
        language: turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
        bookingReadiness: qrState.bookingReadiness,
        steerCTA: turnDirective.steerCTA || "",
        turnCount: qrState.turnCount,
        retrievalConfidence,
        lastAssistantPrompt: state.lastAssistantPrompt || "",
      });
      return saveTurnAndRespond({
        answer: qrResult.answer,
        nextState: qrState,
        stage: "query_resolution",
        contextUsed: context || "",
        languageState: turnLanguageState,
        telemetry: {
          queryResolution: true,
          kbAnswerSource: qrResult.answerSource,
          retrievalConfidence,
          userIntent: state.userIntent,
          intentResolutionMs: state.intentResolutionMs,
          directiveAction: turnDirective.action,
        },
      });
    }

    if (
      ENABLE_KB_CONFIDENCE_GATE &&
      FACTUAL_QUERY_RE.test(normalizedQuery) &&
      retrievalConfidence < KB_CONFIDENCE_MIN
    ) {
      logInfo("[telemetry] kb_gate_triggered", {
        sessionId,
        confidence: retrievalConfidence,
        threshold: KB_CONFIDENCE_MIN,
      });
      const gatedState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
      };
      return saveTurnAndRespond({
        answer: buildLowConfidenceKbReply(
          normalizedQuery,
          turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
        ),
        nextState: gatedState,
        stage: /\b(admission|steps|process|fee|eligib)\b/i.test(normalizedQuery)
          ? "query_resolution"
          : gatedState.stage || "discovery",
        contextUsed: context || "",
        languageState: turnLanguageState,
        telemetry: {
          kbGateTriggered: true,
          intentScore: intentProfile.commitmentScore,
        },
      });
    }

    if (ENABLE_OBJECTION_PLAYBOOKS && nextBestAction.action === "handle_objection" && nextBestAction.objection) {
      const seed = Number(slotState.objectionVariantSeed || 0);
      const playbookReply = buildObjectionPlaybookReply({
        objection: nextBestAction.objection,
        language: languageInstruction.responseLanguage,
        variantSeed: seed,
      });
      const playbookState = {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "objection_handling",
        returnStage: state.returnStage || state.stage || "qualification",
        slotState: {
          ...slotState,
          objectionVariantSeed: seed + 1,
        },
      };
      return saveTurnAndRespond({
        answer: playbookReply,
        nextState: playbookState,
        stage: "objection_handling",
        contextUsed: context || "",
        languageState: turnLanguageState,
      });
    }

    // --- DYNAMIC MEMORY-AWARE LOGIC ---
    const quickCached = getCachedAnswer(sessionId, normalizedQuery);
    if (quickCached && !GENERIC_VALIDATOR_FALLBACK_RE.test(quickCached)) {
      logInfo("[AI] Answer served from session cache", { sessionId, query: normalizedQuery });
      addMessageToSession(sessionId, "user", normalizedQuery);
      addMessageToSession(sessionId, "assistant", quickCached);
      setSessionContext(sessionId, context || "");
      setSessionCallState(sessionId, state);
      return res.status(200).json({
        success: true,
        sessionId,
        answer: quickCached,
        responseLanguage: baseLanguageState?.dominantLanguage || languageConfig.startLanguage,
        languageState: baseLanguageState,
        endCall: false,
        endReason: "",
        leadStatus: state.leadStatus,
        stage: state.stage,
        objective: policy.objective,
        contextUsed: context || "",
        agent: agent._id,
        qualityScore: null,
        fromMemory: true,
        answerSource: "memory",
        answerConfidence: 0.95,
      });
    }

    const cachedAnswer = findCachedAnswer(sessionId, normalizedQuery, context);
    if (cachedAnswer && !GENERIC_VALIDATOR_FALLBACK_RE.test(cachedAnswer)) {
      logInfo("[AI] Answer served from session memory", { sessionId, query: normalizedQuery });
      addMessageToSession(sessionId, "user", normalizedQuery);
      addMessageToSession(sessionId, "assistant", cachedAnswer);
      setSessionContext(sessionId, context || "");
      setSessionCallState(sessionId, state);
      return res.status(200).json({
        success: true,
        sessionId,
        answer: cachedAnswer,
        responseLanguage: baseLanguageState?.dominantLanguage || languageConfig.startLanguage,
        languageState: baseLanguageState,
        endCall: false,
        endReason: "",
        leadStatus: state.leadStatus,
        stage: state.stage,
        objective: policy.objective,
        contextUsed: context || "",
        agent: agent._id,
        qualityScore: null,
        fromMemory: true,
        answerSource: "memory",
        answerConfidence: 0.95,
      });
    }

    state.stage = ensureValidStage(state, signals);

    if (ENABLE_INTERRUPTION_RESUME) {
      const resumeMeta = buildInterruptionResumeMeta(state);
      if (resumeMeta) {
        turnDirective = {
          ...(turnDirective || {}),
          action: turnDirective?.action || "recover_after_interruption",
          interruptionResume: resumeMeta,
        };
      }
    }

    const llmStartedAt = Date.now();
    const llmResult = await generateAIResponse({
      agentPrompt,
      context,
      query: normalizedQuery,
      history: Array.isArray(conversationHistory) && conversationHistory.length
        ? conversationHistory
        : history,
      policy,
      callState: state,
      conversationState,
      analyticsSnapshot,
      languageInstruction,
      nextBestAction,
      objectionGuidance,
      responseStyleProfile,
      experimentProfile: state.experiment || { variant: "control" },
      turnDirective,
    });
    const llmEndedAt = Date.now();

    const rawAnswer = typeof llmResult === "string" ? llmResult : llmResult?.answer || "";
    const llmLeadStatus = typeof llmResult === "object" ? String(llmResult?.leadStatus || "") : "";
    const llmNextStage = typeof llmResult === "object" ? String(llmResult?.nextStage || "") : "";
    const llmEndReason = typeof llmResult === "object" ? String(llmResult?.endReason || "") : "";
    const decisionObj = typeof llmResult === "object" && llmResult?.decision ? llmResult.decision : {};
    const endCall = typeof llmResult === "object" && typeof llmResult.endCall !== "undefined" ? llmResult.endCall : false;
    const endReason = llmEndReason || decisionObj.reason || "";
    const fallback = buildFallbackResponse(policy, state);
    let stabilizedAnswer = enforceNonRepetitiveAnswer(rawAnswer || fallback, state);
    if (
      !endCall &&
      !signals.hardClose &&
      !signals.notInterested &&
      /^(perfect|great|awesome)[!,. ]*(thanks|thank you)[!,. ]*$/i.test(stabilizedAnswer)
    ) {
      stabilizedAnswer = buildProgressKickoffQuestion(state, policy);
    }

    // 2. Cache the new answer in session memory
    addMessageToSession(sessionId, "user", normalizedQuery);
    addMessageToSession(sessionId, "assistant", stabilizedAnswer);
    setSessionContext(sessionId, context || "");
    setSessionCallState(sessionId, state);
    logInfo("[AI] Answer served from LLM and cached", { sessionId, query: normalizedQuery });
    const previousLeadStatus = String(getSessionCallState(sessionId)?.leadStatus || "new");

    if (llmLeadStatus) {
      state.leadStatus = llmLeadStatus;
    }

    if (needsFirstTurnGreeting) {
      state.greeted = true;
    }

    if (endCall) {
      state.stage = "closing";
      state.endCall = true;
      state.endReason = endReason || "conversation_closed";
      state.leadStatus = state.leadStatus === "new" ? "closed" : state.leadStatus;
    } else if (state.leadStatus === "qualified") {
      state.stage = "qualification";
    } else {
      state.stage = llmNextStage || "discovery";
    }

    if (signals.offTopic) {
      state.offTopicCount = Number(state.offTopicCount || 0) + 1;
    }

    const hasActiveUserRequest =
      isCounselorConnectRequest(normalizedQuery) ||
      isSchedulingOrBookingRequest(normalizedQuery, mergeCollectedData(state.collectedData, extractedData)) ||
      (FACTUAL_QUERY_RE.test(normalizedQuery) &&
        normalizedQuery.split(/\s+/).filter(Boolean).length >= 3);

    const userWantsToWrapUp =
      signals.closeConsent ||
      /\b(that(?:'s| is) all|thats all|nothing else|no more questions|all good|we are done|i am done)\b/i.test(
        normalizedQuery,
      );

    const closeConfirmed =
      signals.closeConsent ||
      (slotState.closeConfirmAsked && (signals.closeConfirmationAffirmed || signals.gratitudeClose)) ||
      (state.closeOffered && userWantsToWrapUp);

    const repeatedThanksAfterClosePrompt = shouldEndAfterRepeatedThanks({
      closeConfirmAsked: slotState.closeConfirmAsked,
      gratitudeClose: signals.gratitudeClose,
      thanksCount: slotState.closeConfirmThanksCount,
    });

    if (!signals.hardClose && !signals.notInterested && !hasActiveUserRequest) {
      if (
        isObjectiveAchieved(state) &&
        !state.closeOffered &&
        userWantsToWrapUp &&
        !endCall
      ) {
        const nextState = {
          ...state,
          closeOffered: true,
          turnCount: (state.turnCount || 0) + 1,
          slotState: {
            ...slotState,
            closeConfirmAsked: true,
          },
        };
        return saveTurnAndRespond({
          answer: buildAnythingElsePrompt({
            language: turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
          }),
          nextState,
          endCall: false,
          stage: nextState.stage || "qualification",
          contextUsed: context || "",
          languageState: turnLanguageState,
        });
      }

      if ((closeConfirmed || repeatedThanksAfterClosePrompt) && (state.closeOffered || slotState.closeConfirmAsked)) {
        const nextState = {
          ...state,
          turnCount: (state.turnCount || 0) + 1,
          stage: "closing",
          endCall: true,
          endReason: "user_confirmed_closing",
        };
        return saveTurnAndRespond({
          answer: buildGracefulCloseReply({
            language: turnLanguageState?.dominantLanguage || languageConfig.startLanguage || "en",
            reason: "objective_complete_goodbye",
            orgName: policy.orgName,
          }),
          nextState,
          endCall: true,
          endReason: "user_confirmed_closing",
          stage: "closing",
          contextUsed: context || "",
          languageState: turnLanguageState,
        });
      }
    }

    if (ENABLE_GOAL_DELTA_TRACKING) {
      const delta = computeGoalDelta({
        previousLeadStatus,
        currentLeadStatus: state.leadStatus,
        offTopic: signals.offTopic,
        objection: nextBestAction.objection,
        closeConsent: signals.closeConsent,
      });
      const prevStalled = Number(state?.goalTracker?.stalledTurns || 0);
      state.goalTracker = {
        lastDelta: delta,
        stalledTurns: delta === "stalled" ? prevStalled + 1 : 0,
      };
      if (state.goalTracker.stalledTurns >= 2) {
        state.stage = "discovery";
      }
    }

    let styledAnswer = applyConversationStyle({
      answer: stabilizedAnswer,
      userEmotion: conversationState?.userEmotion || "neutral",
      stage: state.stage || llmNextStage || "discovery",
      turnCount: state.turnCount || 0,
      query: normalizedQuery,
      previousAiMessage: history?.[history.length - 1]?.role === "assistant"
        ? history[history.length - 1].content
        : "",
      responseStyleProfile,
    });
    if (endCall || String(state.stage || llmNextStage || "").toLowerCase() === "closing") {
      styledAnswer = ensureWarmClosing(styledAnswer);
    }
    const finalized = await finalizeOutboundAnswerAsync({
      answer: styledAnswer,
      query: normalizedQuery,
      knowledge: context || "",
      stage: state.stage || llmNextStage || "discovery",
      isOpeningTurn: state.stage === "opening",
      previousAiMessage:
        history?.[history.length - 1]?.role === "assistant"
          ? history[history.length - 1].content
          : "",
      responseStyleProfile,
      enableCompliance: ENABLE_COMPLIANCE_GUARDRAILS,
      enableVoiceRealism: ENABLE_VOICE_REALISM_LAYER,
      regenerateAnswer: ENABLE_COMPLIANCE_REGENERATION ? regenerateCompliantVoiceAnswer : null,
      enableComplianceRetry: ENABLE_COMPLIANCE_REGENERATION,
    });
    if (!finalized.compliance.compliant) {
      logInfo("[telemetry] compliance_blocked", {
        sessionId,
        reason: finalized.compliance.reason,
        complianceRetried: finalized.complianceRetried,
        complianceRecovered: finalized.complianceRecovered,
      });
    }
    const finalAnswer = ENABLE_INTERRUPTION_RESUME
      ? applyInterruptionResumePrefix(
          finalized.answer,
          turnDirective?.interruptionResume || {},
        )
      : finalized.answer;
    const qualityScore = scoreConversationQuality({
      answer: finalAnswer,
      conversationState,
      analyticsSnapshot,
    });

    addMessageToSession(sessionId, "user", normalizedQuery);
    addMessageToSession(sessionId, "assistant", finalAnswer);
    setSessionContext(sessionId, context || "");
    state = clearInterruptionFields(state);
    setSessionCallState(sessionId, state);
    cacheSessionAnswer(sessionId, normalizedQuery, finalAnswer);

    const finalTelemetry = buildTurnTelemetry({
      goalDelta: state?.goalTracker?.lastDelta,
      stalledTurns: state?.goalTracker?.stalledTurns,
      kbGateTriggered: false,
    });
    const finalIntentInsight = buildIntentInsight({ state, turnDirective });
    void upsertLeadOutcome({
      tenantId,
      agentId,
      sessionId,
      roomName: policy.roomName,
      objective: policy.objective,
      stage: state.stage,
      leadStatus: state.leadStatus,
      collectedData: state.collectedData,
      summary: `${policy.objective} stage=${state.stage}`,
      endReason: state.endReason || "",
      isClosed: endCall,
      turnCount: state.turnCount,
      lastUserMessage: normalizedQuery,
      lastAssistantMessage: finalAnswer,
      callbackRequested: Boolean(state.collectedData?.callbackRequested),
      callbackSchedule: state.collectedData?.callbackSchedule || null,
      telemetry: finalTelemetry,
      intentInsight: finalIntentInsight,
      learning: buildCallLearningSnapshot({
        objective: policy.objective,
        stage: state.stage,
        leadStatus: state.leadStatus,
        collectedData: state.collectedData,
        summary: `${policy.objective} stage=${state.stage}`,
        endReason: state.endReason || "",
        isClosed: endCall,
        turnCount: state.turnCount,
        lastUserMessage: normalizedQuery,
        lastAssistantMessage: finalAnswer,
        callbackRequested: Boolean(state.collectedData?.callbackRequested),
        callbackSchedule: state.collectedData?.callbackSchedule || null,
        telemetry: finalTelemetry,
        intentInsight: finalIntentInsight,
        qualityScore,
      }),
    }).catch((error) => {
      console.warn("[lead] outcome upsert failed:", error.message);
    });

    const response = {
      success: true,
      sessionId,
      answer: finalAnswer,
      responseLanguage: languageInstruction.responseLanguage,
      languageState: turnLanguageState,
      endCall,
      endReason: state.endReason || "",
      leadStatus: state.leadStatus,
      stage: state.stage,
      objective: policy.objective,
      abVariant: state?.experiment?.variant || "control",
      contextUsed: context || "",
      agent: agent._id,
      qualityScore,
      nextBestAction: nextBestAction.action,
      goalDelta: state?.goalTracker?.lastDelta || "",
      answerSource: buildConfidence({ chunks, fromMemory: false }).source,
      answerConfidence: retrievalConfidence,
      userIntent: state.userIntent || null,
      intentStatus: state.intentStatus || "pending",
      intentResolutionMs: state.intentResolutionMs || null,
      bookingReadiness: state.bookingReadiness || "not_asked",
      returnStage: state.returnStage || null,
      directiveAction: turnDirective?.action || "",
      interruptedUtterance: "",
      activeTopic: "",
      interruptionPending: false,
    };

    logInfo("[telemetry] turn_metrics", {
      sessionId,
      goalDelta: state?.goalTracker?.lastDelta || "",
      stalledTurns: Number(state?.goalTracker?.stalledTurns || 0),
      kbGateTriggered: false,
      abVariant: state?.experiment?.variant || "control",
      responseStyle: responseStyleProfile.mode,
      wordBudget: responseStyleProfile.wordBudget,
    });

    const latencyInfo = {
      totalMs: Date.now() - requestStartedAt,
      retrievalMs: retrievalEndedAt - retrievalStartedAt,
      llmMs: llmEndedAt - llmStartedAt,
    };

    // Only include debug info if debugLatency is enabled
    if (debugLatency) {
      response.debug = {
        chunkCount: chunks.length,
        latencyMs: latencyInfo,
      };
    }

    // Only log latency if debugLatency is enabled
    if (debugLatency) {
      logInfo(
        `[latency][api] totalMs=${latencyInfo.totalMs} retrievalMs=${latencyInfo.retrievalMs} llmMs=${latencyInfo.llmMs}`,
        { sessionId, query: normalizedQuery },
      );
    }

    // Remove noisy retrieval logs

    return res.status(200).json(response);
  } catch (error) {
    // Enhanced error handling for LLM rate limits and 500s
    let userMessage = error.message || "Internal server error";
    let rateLimitInfo = null;
    if (error?.response?.status === 429 || (error?.message && error.message.toLowerCase().includes("rate limit"))) {
      userMessage = "The AI service is temporarily rate-limited. Please wait a few seconds and try again.";
      rateLimitInfo = error?.response?.data?.rate_limits || null;
    }
    console.error("AI Controller Error:", error.message, rateLimitInfo ? JSON.stringify(rateLimitInfo) : "");
    return res.status(500).json({
      success: false,
      message: userMessage,
      ...(rateLimitInfo ? { rateLimitInfo } : {}),
    });
  }
};
