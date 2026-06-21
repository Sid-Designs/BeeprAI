const ROBOTIC_DEFINITION_RE =
  /\b(is a (?:postgraduate|undergraduate) (?:degree )?program (?:designed|intended) for)\b/i;
const WORDY_RE = /\b(furthermore|moreover|additionally|in addition)\b/i;
const BAD_END_RE = /(including|then we|i can also|and also|for example)\s*\.?$/i;
const GREETING_RE = /^(hello|hi)[!,. ]/i;
const REPETITIVE_RE = /what should i help with next\?/i;
const FACTUAL_QUERY_RE =
  /\b(fee|fees|price|pricing|date|dates|policy|policies|eligib|available|availability|offer|offers|scholarship|deadline|schedul|appointment|counselou?r|book)\w*/i;
const SCHEDULING_TOPIC_RE =
  /\b(schedul\w*|book(?:ing)?|appointment|counselou?r|call me|call you|callback|tomorrow|today|\d{1,2}\s*(?:am|pm))\b/i;
const BOOKING_STAGE_RE =
  /^(appointment_booking|confirmation|callback|booking_readiness)$/i;
const SHORT_ACK_RE =
  /^(yes|yeah|yep|yup|sure|okay|ok|alright|correct|right|haan|ho|ho na|hoy|ठीक|हो|हा|होय)[.!,\s]*$/i;
const ADMISSION_TOPIC_RE =
  /\b(admission|eligib|apply|application|process|course|mca|mba|fee|fees|intake)\b/i;
const NUMBER_CLAIM_RE =
  /\b(?:₹|\$|rs\.?|inr)?\s?\d[\d,.]*(?:\s?(?:lakh|lakhs|crore|crores|percent|%|per year|year|years))?\b/i;
const TIME_MENTION_RE =
  /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)\b|\b(?:morning|afternoon|evening|tonight)\b/i;

export const GENERIC_VALIDATOR_FALLBACK_PATTERNS = [
  /\blet me keep this simple and answer your question directly\b/i,
  /\blet me answer that directly from what i have verified\b/i,
  /\bi do not have that exact detail right now\b/i,
  /\bi do not have that exact verified detail right now\b/i,
];

export const isGenericValidatorFallback = (text = "") =>
  GENERIC_VALIDATOR_FALLBACK_PATTERNS.some((pattern) => pattern.test(String(text || "")));

const clean = (text = "") => String(text || "").replace(/\s+/g, " ").trim();
const tokenize = (text = "") =>
  clean(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);

const isSchedulingContext = ({ query = "", answer = "", stage = "" } = {}) =>
  SCHEDULING_TOPIC_RE.test(query) ||
  SCHEDULING_TOPIC_RE.test(answer) ||
  BOOKING_STAGE_RE.test(String(stage || "").toLowerCase());

const isShortAcknowledgement = (query = "") => {
  const text = clean(query);
  if (!text) return false;
  if (SHORT_ACK_RE.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 3 && SHORT_ACK_RE.test(words[0]);
};

const hasTopicOverlap = (query = "", answer = "") => {
  const queryTokens = new Set(tokenize(query));
  const answerTokens = new Set(tokenize(answer));
  if (!queryTokens.size) return true;
  if (isShortAcknowledgement(query)) return true;
  if (SCHEDULING_TOPIC_RE.test(query) && SCHEDULING_TOPIC_RE.test(answer)) return true;

  let overlap = 0;
  for (const token of queryTokens) {
    if (answerTokens.has(token)) overlap += 1;
  }

  return overlap >= 1;
};

const buildContextualFallback = (query = "") => {
  if (SCHEDULING_TOPIC_RE.test(query)) {
    return "Sure, I can help schedule that. What date and time works best for you?";
  }
  if (ADMISSION_TOPIC_RE.test(query)) {
    return "I can help with admission steps, eligibility, or fees. What would you like to know first?";
  }
  if (FACTUAL_QUERY_RE.test(query)) {
    return "Let me answer that directly from what I have verified.";
  }
  return "Got it. Would you like admission details, fee information, or to schedule a counselor call?";
};

export const validateResponse = ({
  answer = "",
  query = "",
  knowledge = "",
  stage = "discovery",
  isOpeningTurn = false,
  previousAiMessage = "",
  trustedTemplate = false,
} = {}) => {
  let text = clean(answer);
  const issues = [];
  const schedulingContext = isSchedulingContext({ query, answer: text, stage });

  if (!text) issues.push("empty");
  if (BAD_END_RE.test(text)) issues.push("dangling_end");
  if (!isOpeningTurn && GREETING_RE.test(text)) issues.push("repeated_greeting");
  if (REPETITIVE_RE.test(text) && /help with next/i.test(previousAiMessage || "")) {
    issues.push("repetitive_confirmation");
  }
  if (
    !trustedTemplate &&
    query &&
    !isShortAcknowledgement(query) &&
    !schedulingContext &&
    !hasTopicOverlap(query, text)
  ) {
    issues.push("irrelevant_answer");
  }
  if (
    !trustedTemplate &&
    !schedulingContext &&
    FACTUAL_QUERY_RE.test(query) &&
    NUMBER_CLAIM_RE.test(text) &&
    !TIME_MENTION_RE.test(text) &&
    !clean(knowledge)
  ) {
    issues.push("unsupported_factual_claim");
  }
  if (ROBOTIC_DEFINITION_RE.test(text)) issues.push("robotic_definition");
  if (WORDY_RE.test(text)) issues.push("wordy");
  if (text.split(/\s+/).filter(Boolean).length > 45) issues.push("too_long");

  if (issues.includes("repeated_greeting")) {
    text = text.replace(/^(hello|hi)[!,. ]*(this is[^.!?]*[.!?])?\s*/i, "").trim();
  }
  if (issues.includes("dangling_end")) {
    text = text.replace(BAD_END_RE, "").trim();
    if (!/[.!?]$/.test(text)) text = `${text}.`;
  }
  if (issues.includes("repetitive_confirmation")) {
    text = "Let me continue from where we left off.";
  }
  if (issues.includes("irrelevant_answer")) {
    text = buildContextualFallback(query);
  }
  if (issues.includes("unsupported_factual_claim")) {
    text = schedulingContext
      ? buildContextualFallback(query)
      : "I do not have that exact detail right now. I can guide you on the next step.";
  }
  if (issues.includes("robotic_definition")) {
    text = text.replace(ROBOTIC_DEFINITION_RE, "is a").replace(/\s+/g, " ").trim();
  }
  if (issues.includes("wordy")) {
    text = text.replace(WORDY_RE, "").replace(/\s+/g, " ").trim();
  }
  if (issues.includes("too_long")) {
    text = text.split(/[.!?]/).slice(0, 3).map((s) => s.trim()).filter(Boolean).join(". ") + ".";
  }
  if (stage === "closing" && !/\b(bye|goodbye|take care)\b/i.test(text)) {
    text = `${text} Goodbye.`;
  }

  return {
    answer: clean(text),
    valid: issues.length === 0,
    issues,
    score: Math.max(0, 1 - issues.length * 0.2),
  };
};
