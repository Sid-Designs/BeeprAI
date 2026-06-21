const ACK_RE = /^(yes|yeah|yep|ok|okay|hmm|right|got it|sure)\b/i;
const CLOSE_RE = /\b(bye|goodbye|cut the call|end call|hang up|stop)\b/i;
const CALLBACK_RE = /\b(call back|callback|tomorrow|today|am|pm|later)\b/i;
const FEES_RE = /\b(fee|fees|cost|price)\b/i;
const COURSE_RE = /\b(course|program|mca|mba|bca|admission|eligibility)\b/i;

export const ConversationStages = Object.freeze({
  GREETING: "greeting",
  DISCOVERY: "discovery",
  QUALIFICATION: "qualification",
  COURSE_EXPLANATION: "course_explanation",
  FEE_DISCUSSION: "fee_discussion",
  OBJECTION_HANDLING: "objection_handling",
  CLARIFICATION: "clarification",
  INFORMATION_COLLECTION: "information_collection",
  SCHEDULING: "scheduling",
  CLOSING: "closing",
});

export const decideDialogueAction = ({ userText = "", state = {} } = {}) => {
  const text = String(userText || "").trim();
  const lower = text.toLowerCase();

  if (!lower) {
    return { action: "wait", reason: "empty", stage: state.stage || ConversationStages.DISCOVERY };
  }
  if (CLOSE_RE.test(lower)) {
    return { action: "close", reason: "user_close", stage: ConversationStages.CLOSING };
  }
  if (CALLBACK_RE.test(lower)) {
    return { action: "schedule_callback", reason: "callback_intent", stage: ConversationStages.SCHEDULING };
  }
  if (ACK_RE.test(lower) && state.unfinishedThought) {
    return { action: "continue", reason: "ack_continuation", stage: state.stage };
  }
  if (FEES_RE.test(lower)) {
    return { action: "answer_topic", reason: "fees_topic", stage: ConversationStages.FEE_DISCUSSION, topic: "fees" };
  }
  if (COURSE_RE.test(lower)) {
    return {
      action: "answer_topic",
      reason: "admission_topic",
      stage: ConversationStages.COURSE_EXPLANATION,
      topic: "admission",
    };
  }
  if (ACK_RE.test(lower)) {
    return { action: "probe", reason: "short_ack", stage: state.stage || ConversationStages.DISCOVERY };
  }
  return { action: "answer_topic", reason: "general", stage: state.stage || ConversationStages.DISCOVERY };
};

export const buildModeConstraints = (stage = ConversationStages.DISCOVERY) => {
  const base = { maxWords: 22, askFollowUp: true, tone: "calm", pace: "normal", confidenceFloor: 0.55 };
  if (stage === ConversationStages.GREETING) return { ...base, maxWords: 16, askFollowUp: true, pace: "warm" };
  if (stage === ConversationStages.COURSE_EXPLANATION) return { ...base, maxWords: 26, tone: "clear" };
  if (stage === ConversationStages.FEE_DISCUSSION) return { ...base, maxWords: 20, tone: "precise" };
  if (stage === ConversationStages.CLARIFICATION) return { ...base, maxWords: 16, tone: "simple" };
  if (stage === ConversationStages.SCHEDULING) return { ...base, maxWords: 14, askFollowUp: true, tone: "decisive" };
  if (stage === ConversationStages.CLOSING) return { ...base, maxWords: 10, askFollowUp: false, tone: "closing" };
  return base;
};

