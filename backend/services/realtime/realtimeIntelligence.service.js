import LeadOutcome from "../../models/leadOutcome.model.js";

const LOW_INTENT_RE =
  /^(hi|hello|hey|ok|okay|yes|yeah|yep|no|nope|thanks|thank you|hmm|uh|huh)$/i;
const REPEATABLE_INTENT_RE =
  /\b(fees?|price|pricing|admission|eligibility|duration|timing|schedule|documents?|process)\b/i;
const HARD_CLOSE_RE = /\b(hang up|end the call|end call|disconnect|do not call|stop calling)\b/i;
const CLOSE_CONSENT_RE =
  /\b(no|nothing else|that(?:'s| is) all|all good|we are done|bye|goodbye|end call)\b/i;
const OFF_TOPIC_HINT_RE =
  /\b(weather|sports|movie|politics|joke|music)\b/i;

const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeKey = (value = "") => normalizeText(value).toLowerCase();

const cleanField = (value, max = 120) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const pushUnique = (list, value) => {
  if (!value) return list;
  if (list.includes(value)) return list;
  list.push(value);
  return list;
};

export const buildCustomerMemorySnapshot = async ({
  tenantId,
  agentId,
  callerNumber = "",
  limit = 8,
} = {}) => {
  if (!tenantId || !agentId) {
    return {
      summary: "",
      profile: { knownFacts: {}, objectionPatterns: [], preferredLanguage: "en" },
      recentOutcomes: [],
    };
  }

  const outcomes = await LeadOutcome.find({ tenantId, agentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const callerDigits = String(callerNumber || "").replace(/\D+/g, "");
  const byCaller = callerDigits
    ? outcomes.filter((item) => {
        const candidate = String(
          item?.collectedData?.phone
            || item?.collectedData?.mobile
            || item?.collectedData?.contact
            || "",
        ).replace(/\D+/g, "");
        return candidate && (candidate.endsWith(callerDigits) || callerDigits.endsWith(candidate));
      })
    : [];

  const candidateList = byCaller.length ? byCaller : outcomes;
  const facts = {};
  const objections = [];
  let preferredLanguage = "en";

  for (const row of candidateList) {
    const data = row?.collectedData || {};
    if (!facts.name && data.name) facts.name = cleanField(data.name, 80);
    if (!facts.course && (data.course || data.interest)) {
      facts.course = cleanField(data.course || data.interest, 120);
    }
    if (!facts.timeline && (data.timeline || data.preferred_date)) {
      facts.timeline = cleanField(data.timeline || data.preferred_date, 80);
    }
    if (!facts.phone && (data.phone || data.mobile || data.contact)) {
      facts.phone = cleanField(data.phone || data.mobile || data.contact, 40);
    }
    if (!facts.callbackSchedule && row?.callbackSchedule?.text) {
      facts.callbackSchedule = cleanField(row.callbackSchedule.text, 120);
    }
    pushUnique(objections, cleanField(data.objection || data.concern || "", 140));
    if (data.language && preferredLanguage === "en") {
      preferredLanguage = cleanField(data.language, 20).toLowerCase();
    }
  }

  const summaryLines = [];
  if (facts.name) summaryLines.push(`Caller name: ${facts.name}`);
  if (facts.course) summaryLines.push(`Interest: ${facts.course}`);
  if (facts.timeline) summaryLines.push(`Timeline: ${facts.timeline}`);
  if (facts.callbackSchedule) summaryLines.push(`Preferred callback: ${facts.callbackSchedule}`);
  if (objections.length) summaryLines.push(`Past objections: ${objections.slice(0, 3).join("; ")}`);
  summaryLines.push("Use these facts only if consistent with current call.");

  return {
    summary: summaryLines.join("\n").slice(0, 1000),
    profile: {
      knownFacts: facts,
      objectionPatterns: objections.slice(0, 6),
      preferredLanguage,
    },
    recentOutcomes: candidateList.slice(0, 5).map((row) => ({
      stage: cleanField(row.stage, 60),
      leadStatus: cleanField(row.leadStatus, 40),
      summary: cleanField(row.summary, 220),
      lastUserMessage: cleanField(row.lastUserMessage, 180),
      updatedAt: row.updatedAt || row.createdAt || null,
    })),
  };
};

export const decideRealtimeTurnStrategy = ({
  userText = "",
  cachedAnswer = "",
  memorySummary = "",
} = {}) => {
  const text = normalizeText(userText);
  const key = normalizeKey(text);

  if (!key) {
    return { mode: "skip", reason: "empty_user_text", localResponse: "" };
  }

  if (cachedAnswer) {
    return { mode: "cache", reason: "exact_cached_answer", localResponse: cachedAnswer };
  }

  if (LOW_INTENT_RE.test(text)) {
    const localResponse = "I am here with you. Please tell me what you would like to know.";
    return { mode: "template", reason: "low_intent_ack", localResponse };
  }

  if (REPEATABLE_INTENT_RE.test(text) && memorySummary) {
    return { mode: "hybrid", reason: "known_repeatable_intent", localResponse: "" };
  }

  return { mode: "model", reason: "needs_model", localResponse: "" };
};

export const buildRealtimeSessionInstructions = ({
  baseInstruction = "",
  memorySummary = "",
  compactSummary = "",
  intentState = {},
} = {}) => {
  const sections = [
    normalizeText(baseInstruction),
    "Conversation policy: avoid repeating full policy each turn; continue naturally from prior context.",
    "Cost policy: if a user asks the same thing and answer is known, answer directly and briefly.",
  ].filter(Boolean);

  if (memorySummary) {
    sections.push(`Known customer memory:\n${memorySummary}`);
  }

  if (compactSummary) {
    sections.push(`Current call rolling summary:\n${compactSummary}`);
  }

  if (intentState?.primaryIntent) {
    sections.push(
      `Active primary intent: ${intentState.primaryIntent}\nIntent status: ${intentState.status || "pending"}`,
    );
  }

  return sections.join("\n\n").slice(0, 7000);
};

export const buildRealtimeTurnInstruction = ({
  primaryIntent = "",
  intentStatus = "pending",
} = {}) =>
  [
    "Continue from the caller's latest message only.",
    "Respond in under 25 words unless clarity requires one extra short sentence.",
    "Speak naturally and keep the answer context-focused.",
    "Use only knowledge base or provided business context for business facts.",
    `Stay focused on active primary intent: ${normalizeText(primaryIntent) || "assist caller"}.`,
    `Current intent status: ${normalizeText(intentStatus) || "pending"}.`,
    "If the user is off-topic: acknowledge briefly and softly redirect to the primary intent.",
    "If intent is complete, ask if anything else is needed before closing.",
    "Never end only because user says thanks once.",
  ].join(" ");

export const deriveIntentStatusUpdate = ({
  userText = "",
  previousStatus = "pending",
  primaryIntent = "",
} = {}) => {
  const text = normalizeText(userText).toLowerCase();
  const status = String(previousStatus || "pending").toLowerCase();
  if (!text) return status;
  if (HARD_CLOSE_RE.test(text)) return "abandoned";
  if (status === "pending") return "in_progress";
  if (/\b(done|resolved|completed|that helps|sorted)\b/.test(text)) return "completed";
  if (CLOSE_CONSENT_RE.test(text) && (status === "completed" || status === "closing_confirmed")) {
    return "closing_confirmed";
  }
  if (OFF_TOPIC_HINT_RE.test(text) && primaryIntent) return status;
  return status;
};

export const detectClosingSignals = ({ userText = "", closeConfirmAsked = false } = {}) => {
  const text = normalizeText(userText).toLowerCase();
  const hardClose = HARD_CLOSE_RE.test(text);
  const closeConsent = CLOSE_CONSENT_RE.test(text);
  const offTopic = OFF_TOPIC_HINT_RE.test(text);
  const shouldClose = hardClose || (closeConfirmAsked && closeConsent);
  return { hardClose, closeConsent, offTopic, shouldClose };
};
