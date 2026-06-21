const cleanText = (value = "", max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const scoreFromPatterns = (text = "", patterns = []) =>
  patterns.reduce((best, entry) => (entry.pattern.test(text) ? Math.max(best, entry.score) : best), 0);

const HOT_PATTERNS = [
  { pattern: /\b(definitely|absolutely|for sure|100%|i want to|want to enroll|ready to apply|let's do it)\b/i, score: 90 },
  { pattern: /\b(book now|enroll now|sign me up|start the process)\b/i, score: 88 },
];

const WARM_PATTERNS = [
  { pattern: /\b(interested|seriously considering|thinking about|want details|looking for)\b/i, score: 72 },
  { pattern: /\b(tell me more|share details|what are the fees|what is the process)\b/i, score: 68 },
];

const LUKEWARM_PATTERNS = [
  { pattern: /\b(maybe|might|curious|exploring|just checking)\b/i, score: 52 },
];

const COLD_PATTERNS = [
  { pattern: /\b(not sure|hesitant|need time|let me think|need to discuss)\b/i, score: 32 },
];

const REJECT_PATTERNS = [
  { pattern: /\b(not interested|no thanks|don't call|do not call|remove me)\b/i, score: 8 },
];

const classifyScore = (score = 0) => {
  if (score >= 80) return { label: "hot_lead", recommendedAction: "book_or_qualify_now" };
  if (score >= 60) return { label: "warm_lead", recommendedAction: "share_details_and_progress" };
  if (score >= 40) return { label: "lukewarm_lead", recommendedAction: "address_concerns_and_nurture" };
  if (score >= 20) return { label: "cold_lead", recommendedAction: "gently_probe_and_offer_callback" };
  return { label: "not_interested", recommendedAction: "respect_exit_or_soft_future_option" };
};

export const analyzeIntent = ({ query = "", signals = {}, collectedData = {} } = {}) => {
  const text = cleanText(query, 500);
  if (!text) {
    return {
      commitmentScore: 0,
      label: "unknown",
      recommendedAction: "clarify_intent",
      reason: "empty_query",
    };
  }

  let score = 45;
  let reason = "baseline_interest";

  const reject = scoreFromPatterns(text, REJECT_PATTERNS);
  const hot = scoreFromPatterns(text, HOT_PATTERNS);
  const warm = scoreFromPatterns(text, WARM_PATTERNS);
  const lukewarm = scoreFromPatterns(text, LUKEWARM_PATTERNS);
  const cold = scoreFromPatterns(text, COLD_PATTERNS);

  if (reject) {
    score = reject;
    reason = "explicit_rejection";
  } else if (hot) {
    score = hot;
    reason = "explicit_commitment";
  } else if (warm) {
    score = warm;
    reason = "clear_interest";
  } else if (lukewarm) {
    score = lukewarm;
    reason = "tentative_interest";
  } else if (cold) {
    score = cold;
    reason = "hesitant_interest";
  }

  if (signals.notInterested) {
    score = Math.min(score, 10);
    reason = "signal_not_interested";
  } else if (signals.hardClose) {
    score = Math.min(score, 15);
    reason = "signal_hard_close";
  } else if (signals.interest) {
    score = Math.max(score, 65);
  } else if (signals.uncertain) {
    score = Math.min(score, 40);
  }

  if (collectedData.course || collectedData.interest) {
    score = Math.min(100, score + 6);
  }
  if (collectedData.timeline || collectedData.preferred_date) {
    score = Math.min(100, score + 4);
  }

  const classification = classifyScore(score);
  return {
    commitmentScore: score,
    ...classification,
    reason,
  };
};
