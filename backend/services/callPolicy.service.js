import { extractLeadData } from "./conversation/dataExtraction.service.js";
import { analyzeIntent } from "./conversation/intentAnalyzer.service.js";
import { detectConversationSignals as detectSignalsWithConfidence } from "./conversation/signalDetection.service.js";
import { prepareTextForTTS } from "./pronunciationPrep.service.js";

const DEFAULT_OBJECTIVE_BY_TYPE = Object.freeze({
  appointment: "appointment_booking",
  sales: "lead_generation",
  support: "support_inquiry",
  custom: "custom",
});

const DEFAULT_REASON_BY_OBJECTIVE = Object.freeze({
  lead_generation: "follow up on your interest and understand your requirements",
  appointment_booking: "help you schedule an appointment",
  qualification: "understand your needs and qualify the request",
  support_inquiry: "help resolve your query",
  custom: "help you with your request",
});

const DEFAULT_QUALIFICATION_FIELDS = Object.freeze({
  lead_generation: ["name", "interest", "timeline"],
  appointment_booking: ["preferred_date", "preferred_time", "name"],
  qualification: ["name", "need", "timeline"],
  support_inquiry: ["name", "issue"],
  custom: ["name", "need"],
});

const ALLOWED_OBJECTIVES = new Set([
  "lead_generation",
  "appointment_booking",
  "qualification",
  "support_inquiry",
  "custom",
]);

const cleanText = (value, max = 400) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const uniqueStrings = (values = []) => {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  for (const item of values) {
    const value = cleanText(item, 80).toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
};

const normalizeLanguageKey = (value = "") => {
  const v = cleanText(value, 20).toLowerCase();
  if (v === "hindi" || v === "hi") return "hi";
  if (v === "marathi" || v === "mr") return "mr";
  return "en";
};

const resolveObjective = ({ requestedObjective, agent, tenant }) => {
  const objective =
    cleanText(requestedObjective, 80).toLowerCase() ||
    cleanText(agent?.callConfig?.objective, 80).toLowerCase() ||
    cleanText(tenant?.metadata?.calling?.objective, 80).toLowerCase() ||
    DEFAULT_OBJECTIVE_BY_TYPE[agent?.type] ||
    "custom";

  if (!ALLOWED_OBJECTIVES.has(objective)) return "custom";
  return objective;
};

export const buildCallPolicy = ({
  tenant,
  agent,
  roomName = "",
  callObjective = "",
  callConfig = {},
}) => {
  const tenantCalling = tenant?.metadata?.calling || {};
  const mergedCallConfig = {
    ...(tenantCalling || {}),
    ...(agent?.callConfig || {}),
    ...(callConfig || {}),
  };

  const objective = resolveObjective({
    requestedObjective: callObjective || mergedCallConfig.objective,
    agent,
    tenant,
  });

  const reasonForCalling =
    cleanText(
      mergedCallConfig.reasonForCalling,
      280,
    ) || DEFAULT_REASON_BY_OBJECTIVE[objective];

  const primaryGoal =
    cleanText(
      mergedCallConfig.primaryGoal,
      280,
    ) || "Help the caller with accurate information and guide the next step naturally.";

  const openingScript = cleanText(mergedCallConfig.openingScript, 350);
  const businessContext =
    cleanText(mergedCallConfig.businessContext, 1200) ||
    cleanText(agent?.script, 1200);

  const qualificationFields = uniqueStrings(
    mergedCallConfig.qualificationFields?.length
      ? mergedCallConfig.qualificationFields
      : DEFAULT_QUALIFICATION_FIELDS[objective] || DEFAULT_QUALIFICATION_FIELDS.custom,
  );

  const rawLangConfig =
    mergedCallConfig.languageConfig && typeof mergedCallConfig.languageConfig === "object"
      ? mergedCallConfig.languageConfig
      : {};
  const allowedLanguages = Array.isArray(rawLangConfig.allowedLanguages) && rawLangConfig.allowedLanguages.length
    ? [...new Set(rawLangConfig.allowedLanguages.map((item) => normalizeLanguageKey(item)))]
    : ["en", "hi", "mr"];
  const startLanguage = allowedLanguages.includes(normalizeLanguageKey(rawLangConfig.startLanguage))
    ? normalizeLanguageKey(rawLangConfig.startLanguage)
    : allowedLanguages[0] || "en";

  const personaConfig =
    mergedCallConfig.personaConfig && typeof mergedCallConfig.personaConfig === "object"
      ? mergedCallConfig.personaConfig
      : {};
  const voiceProfileRaw =
    mergedCallConfig.voiceProfile && typeof mergedCallConfig.voiceProfile === "object"
      ? mergedCallConfig.voiceProfile
      : {};

  return {
    tenantId: tenant?._id?.toString?.() || "",
    agentId: agent?._id?.toString?.() || "",
    roomName: cleanText(roomName, 120),
    orgName: cleanText(tenant?.orgName, 100),
    industry: cleanText(tenant?.industry, 80),
    agentName: cleanText(agent?.name, 100),
    agentType: cleanText(agent?.type, 60),
    tone: cleanText(agent?.tone, 40) || "neutral",
    objective,
    reasonForCalling,
    primaryGoal,
    openingScript,
    businessContext,
    qualificationFields,
    allowHandoff: Boolean(mergedCallConfig.allowHandoff),
    allowAppointmentBooking: Boolean(mergedCallConfig.allowAppointmentBooking),
    appointmentVisitType: cleanText(mergedCallConfig.appointmentVisitType, 40) || "campus_visit",
    appointmentVisitLabel: cleanText(mergedCallConfig.appointmentVisitLabel, 120),
    languageConfig: {
      startLanguage,
      allowedLanguages,
      allowCodeMix: rawLangConfig.allowCodeMix !== false,
      style: cleanText(rawLangConfig.style, 40) || "mirror_user",
    },
    personaConfig: {
      tone: cleanText(personaConfig.tone, 40) || "premium_polished",
      proactiveness: cleanText(personaConfig.proactiveness, 40) || "high",
      empathyLevel: cleanText(personaConfig.empathyLevel, 40) || "adaptive",
      closingStyle: cleanText(personaConfig.closingStyle, 40) || "soft",
    },
    voiceProfile: {
      pace: cleanText(voiceProfileRaw.pace, 60) || "medium",
      pitch: cleanText(voiceProfileRaw.pitch, 60) || "naturally_varied",
      energy: cleanText(voiceProfileRaw.energy, 80) || "warm_calm_interested",
      volume: cleanText(voiceProfileRaw.volume, 80) || "comfortable_never_pushy",
      pauseStyle: cleanText(voiceProfileRaw.pauseStyle, 80) || "short_natural_pauses",
      slowWhenExplaining: cleanText(voiceProfileRaw.slowWhenExplaining, 20) || "yes",
      slightlyFasterWhenConfirming: cleanText(voiceProfileRaw.slightlyFasterWhenConfirming, 20) || "yes",
    },
  };
};

export const INTENT_RESOLUTION_THRESHOLD = Number.parseFloat(
  process.env.INTENT_CONFIDENCE_THRESHOLD || "0.75",
);

export const getInitialConversationState = (policy = {}) => ({
  stage: "greeting",
  objective: policy.objective || "custom",
  primaryIntent: policy.primaryGoal || policy.objective || "custom",
  intentStatus: "pending",
  userIntent: {
    intent: "unknown",
    confidence: 0,
    subTopics: [],
    source: "baseline",
  },
  intentResolvedAtTurn: null,
  intentResolutionMs: null,
  callStartedAt: null,
  bookingReadiness: "not_asked",
  returnStage: null,
  pendingSlot: null,
  turnDirective: null,
  objectiveAchieved: false,
  objectiveAchievedReason: "",
  closeOffered: false,
  intentMenuOffered: false,
  greeted: false,
  offTopicCount: 0,
  turnCount: 0,
  leadStatus: "new",
  collectedData: {},
  endCall: false,
  endReason: "",
  interruptedUtterance: "",
  activeTopic: "",
  interruptionPending: false,
});

export const buildOpeningMessage = (policy = {}) => {
  if (policy.openingScript) return prepareTextForTTS(policy.openingScript);

  const agentName = policy.agentName || "the assistant";
  const orgName = prepareTextForTTS(policy.orgName || "our team");
  const reason = policy.reasonForCalling || "help you";
  const objective = cleanText(policy.objective, 80).toLowerCase();
  const startLanguage = cleanText(policy.languageConfig?.startLanguage, 10).toLowerCase() || "en";

  if (startLanguage === "hi") {
    return `Namaste, main ${agentName} bol raha hoon ${orgName} se. ${reason} mein help karne ke liye call kiya hai. Kya abhi baat kar sakte hain?`;
  }
  if (startLanguage === "mr") {
    return `Namaskar, mi ${agentName} बोलतोय ${orgName} कडून. ${reason} साठी कॉल केला आहे. आत्ता बोलायला वेळ आहे का?`;
  }

  if (objective === "appointment_booking") {
    return `Hello! This is ${agentName} from ${orgName}. I am calling to ${reason}. I can help schedule this quickly. Is now a good time?`;
  }

  if (objective === "lead_generation" || objective === "qualification") {
    return `Hello! This is ${agentName} from ${orgName}. I am calling to ${reason}. It will just take a minute, is now a good time?`;
  }

  if (objective === "support_inquiry") {
    return `Hello! This is ${agentName} from ${orgName}. I am calling to ${reason}. I can help resolve this step by step. Is now a good time?`;
  }

  return `Hello! This is ${agentName} from ${orgName}. I am calling to ${reason}. Is this a good time for a quick discussion?`;
};

export const detectConversationSignals = (query = "") => detectSignalsWithConfidence(query);
export const extractLeadDataFromQuery = (query = "") => extractLeadData(query);
export const analyzeLeadIntent = ({ query = "", signals = {}, collectedData = {} } = {}) =>
  analyzeIntent({ query, signals, collectedData });

export const mergeCollectedData = (current = {}, incoming = {}) => {
  const base = {
    ...(current || {}),
  };
  const next = {
    ...(incoming || {}),
  };

  if (base.course && next.course) {
    const oldCourse = cleanText(base.course, 80).toLowerCase();
    const newCourse = cleanText(next.course, 80).toLowerCase();
    if (oldCourse && newCourse && oldCourse !== newCourse) {
      delete next.course;
    }
  }

  return {
    ...base,
    ...next,
  };
};

export const computeLeadStatus = ({
  currentStatus = "new",
  signals = {},
  collectedData = {},
  intentProfile = {},
  objective = "custom",
}) => {
  if (signals.hardClose || signals.notInterested) return "not_interested";

  const hasIdentity = Boolean(collectedData.name || collectedData.email);
  const hasNeed = Boolean(
    collectedData.interest ||
      collectedData.course ||
      collectedData.timeline ||
      collectedData.preferred_date,
  );

  if (objective === "appointment_booking") {
    if (hasIdentity && (collectedData.preferred_date || collectedData.preferred_time)) {
      return "qualified";
    }
  }

  if (hasIdentity && hasNeed) return "qualified";
  if (Number(intentProfile?.commitmentScore || 0) >= 80 && hasNeed) return "qualified";
  if (Number(intentProfile?.commitmentScore || 0) >= 60) return "interested";
  if (signals.interest || hasNeed) return "interested";
  if (signals.uncertain) return "unsure";

  return currentStatus || "new";
};

export const getEndCallDecision = ({ signals = {}, leadStatus = "", stage = "" }) => {
  if (signals.hardClose) {
    return { endCall: true, reason: "user_requested_end" };
  }

  if (signals.notInterested) {
    return { endCall: true, reason: "user_not_interested" };
  }

  if (stage === "closing" && signals.closeConsent) {
    return { endCall: true, reason: "user_confirmed_closing" };
  }

  return { endCall: false, reason: "" };
};

export const shouldEndAfterRepeatedThanks = ({
  closeConfirmAsked = false,
  gratitudeClose = false,
  thanksCount = 0,
}) => Boolean(closeConfirmAsked && gratitudeClose && Number(thanksCount || 0) >= 1);

export const computeGoalDelta = ({
  previousLeadStatus = "new",
  currentLeadStatus = "new",
  offTopic = false,
  objection = "",
  closeConsent = false,
} = {}) => {
  if (closeConsent) return "moved_closer";
  if (offTopic) return "off_track";
  if (objection) return "stalled";
  const rank = {
    new: 0,
    interested: 1,
    unsure: 1,
    qualified: 2,
    closed: 3,
    not_interested: 0,
  };
  const prev = Number(rank[String(previousLeadStatus || "new")] || 0);
  const curr = Number(rank[String(currentLeadStatus || "new")] || 0);
  if (curr > prev) return "moved_closer";
  if (curr < prev) return "off_track";
  return "stalled";
};
