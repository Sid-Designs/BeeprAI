const clean = (value, max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const UNCLEAR_RE =
  /\b(sorry\??|come again|pardon|i did(?:n't| not) get|not clear|what did you say|can you repeat)\b/i;
const INTENT_SHIFT_RE =
  /\b(instead|change topic|different topic|not that|forget that|new question|switch to)\b/i;
const INTENT_SHIFT_ACTUALLY_RE =
  /\bactually\b.{8,}/i;

export const detectRecoveryNeed = ({
  query = "",
  state = {},
  currentIntent = "",
} = {}) => {
  const text = clean(query, 500);
  if (!text) return { recoveryType: "", suggestedReply: "" };

  if (UNCLEAR_RE.test(text)) {
    return {
      recoveryType: "asr_or_clarity",
      suggestedReply: "Sorry, let me say that clearly in one line. Tell me the one part you want first.",
    };
  }

  const userIntent = clean(currentIntent, 80).toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const shiftSignal =
    INTENT_SHIFT_RE.test(text) ||
    (INTENT_SHIFT_ACTUALLY_RE.test(text) && wordCount >= 4);

  if (shiftSignal && userIntent && userIntent !== "unknown") {
    const topic = userIntent.replace(/_/g, " ");
    return {
      recoveryType: "intent_shift_confirmation",
      suggestedReply: `Got it. Should I continue with ${topic}, or focus on your new question?`,
    };
  }

  const knownCourse = clean(state?.collectedData?.course, 80).toLowerCase();
  const queryCourseMatch = text.match(/\b(bca|bba|mba|mca|btech|mtech|bcom|bsc)\b/i);
  if (knownCourse && queryCourseMatch && knownCourse !== queryCourseMatch[1].toLowerCase()) {
    return {
      recoveryType: "contradiction",
      suggestedReply: `Quick check: earlier I noted ${knownCourse.toUpperCase()}. Should I update it to ${queryCourseMatch[1].toUpperCase()}?`,
    };
  }

  return { recoveryType: "", suggestedReply: "" };
};

