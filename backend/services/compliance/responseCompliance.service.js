const clean = (value, max = 5000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const FACTUAL_RE =
  /\b(fee|fees|price|pricing|policy|policies|eligib|available|availability|offer|offers|scholarship|deadline|date|dates)\b/i;
const SCHEDULING_RE =
  /\b(schedul\w*|book(?:ing)?|appointment|counselou?r|call me|call you|callback|tomorrow|today|\d{1,2}\s*(?:am|pm))\b/i;
const NUMBER_RE = /\b\d+(?:[.,]\d+)?\b/g;

const tokenize = (text = "") =>
  clean(text, 4000)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export const validateResponseCompliance = ({
  query = "",
  answer = "",
  knowledge = "",
} = {}) => {
  const q = clean(query, 500).toLowerCase();
  const a = clean(answer, 800);
  const k = clean(knowledge, 4000).toLowerCase();

  if (!a) return { compliant: true, reason: "", safeAnswer: a };
  if (SCHEDULING_RE.test(q)) return { compliant: true, reason: "", safeAnswer: a };
  if (!FACTUAL_RE.test(q)) return { compliant: true, reason: "", safeAnswer: a };

  const answerNumbers = (a.match(NUMBER_RE) || []).slice(0, 6);
  const hasUnbackedNumber = answerNumbers.some((n) => !k.includes(n));

  const answerTokens = new Set(tokenize(a));
  const knowledgeTokens = new Set(tokenize(k));
  let overlap = 0;
  answerTokens.forEach((t) => {
    if (knowledgeTokens.has(t)) overlap += 1;
  });
  const overlapRatio = answerTokens.size ? overlap / answerTokens.size : 1;

  if (hasUnbackedNumber || overlapRatio < 0.12) {
    return {
      compliant: false,
      reason: hasUnbackedNumber ? "unbacked_numeric_claim" : "low_evidence_overlap",
      safeAnswer:
        "I do not have that exact verified detail right now. I can share the confirmed process and next step.",
    };
  }

  return { compliant: true, reason: "", safeAnswer: a };
};

