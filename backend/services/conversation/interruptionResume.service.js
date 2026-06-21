const cleanText = (value = "", max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const INTERRUPTION_MIN_EXPLANATION_WORDS = Number.parseInt(
  process.env.INTERRUPTION_MIN_EXPLANATION_WORDS || "12",
  10,
);

const INTENT_TOPIC_MAP = Object.freeze({
  fee_inquiry: "fees",
  admission_inquiry: "admission",
  appointment_booking: "appointment",
  information_request: "course details",
  support_request: "support",
  callback_request: "callback",
});

export const isMidExplanationInterrupt = (utterance = "") => {
  const words = cleanText(utterance, 600).split(" ").filter(Boolean);
  return words.length >= INTERRUPTION_MIN_EXPLANATION_WORDS;
};

export const deriveActiveTopic = ({
  userIntent = {},
  directiveAction = "",
} = {}) => {
  const subTopic = userIntent?.subTopics?.[0];
  if (subTopic) return cleanText(subTopic, 80).toLowerCase();

  const intent = cleanText(userIntent?.intent, 40);
  if (INTENT_TOPIC_MAP[intent]) return INTENT_TOPIC_MAP[intent];
  if (directiveAction === "answer_then_steer") return "your question";
  return "";
};

export const buildInterruptionResumeMeta = (state = {}) => {
  if (!state?.interruptionPending || !state?.interruptedUtterance) return null;

  const interruptedUtterance = cleanText(state.interruptedUtterance, 480);
  if (!interruptedUtterance) return null;

  return {
    interruptedUtterance,
    activeTopic: cleanText(state.activeTopic, 80),
    midExplanation: isMidExplanationInterrupt(interruptedUtterance),
  };
};

export const applyInterruptionContextToState = (state = {}, interruptionContext = null) => {
  if (!interruptionContext?.interruptedUtterance) return state;

  return {
    ...state,
    interruptedUtterance: cleanText(interruptionContext.interruptedUtterance, 480),
    activeTopic: cleanText(interruptionContext.activeTopic, 80),
    interruptionPending: true,
  };
};

export const clearInterruptionFields = (state = {}) => ({
  ...state,
  interruptedUtterance: "",
  activeTopic: "",
  interruptionPending: false,
});

export const applyInterruptionResumePrefix = (
  answer = "",
  { midExplanation = false } = {},
) => {
  const text = cleanText(answer, 500);
  if (!midExplanation || !text) return text;
  if (/^(sure|okay|right)\s*[—,-]/i.test(text)) return text;

  const body = text.charAt(0).toLowerCase() + text.slice(1);
  return `Sure — as I was saying, ${body}`;
};

export const buildInterruptionResumePromptBlock = ({
  interruptedUtterance = "",
  activeTopic = "",
  userQuery = "",
} = {}) => {
  const prior = cleanText(interruptedUtterance, 280);
  if (!prior) return "";

  const topic = cleanText(activeTopic, 80) || "the previous point";
  const query = cleanText(userQuery, 200);

  return [
    "INTERRUPTION RESUME:",
    `You were interrupted mid-explanation while discussing ${topic}.`,
    `Cut-off reply: "${prior}"`,
    query ? `Caller now says: "${query}"` : "",
    "Acknowledge briefly only if natural, then answer the latest message.",
    "Continue the prior thread when it helps; do not repeat the full cut-off reply.",
  ]
    .filter(Boolean)
    .join(" ");
};
