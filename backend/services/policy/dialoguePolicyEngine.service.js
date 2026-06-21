const normalize = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const detectIntentLabel = (text = "") => {
  const v = normalize(text);
  if (!v) return "unknown";
  if (/\b(bye|goodbye|hang up|end call|stop)\b/.test(v)) return "closing";
  if (/\b(call back|callback|tomorrow|today|am|pm|morning|afternoon|evening)\b/.test(v)) return "callback";
  if (/\b(admission|apply|application|eligibility|fees|course|program|process)\b/.test(v)) return "admission_query";
  if (/\b(help|assist|guide|support)\b/.test(v)) return "help_request";
  if (/^(yes|ok|okay|sure|thanks|thank you)\b/.test(v)) return "ack";
  return "general_query";
};

export const buildTurnPolicy = ({
  objective = "custom",
  intent = "general_query",
} = {}) => {
  const base = {
    maxWords: 18,
    askQuestion: true,
    endCall: false,
  };

  if (intent === "closing") {
    return { ...base, maxWords: 10, askQuestion: false, endCall: true };
  }
  if (intent === "ack") {
    return { ...base, maxWords: 10, askQuestion: true };
  }
  if (intent === "callback") {
    return { ...base, maxWords: 14, askQuestion: true };
  }
  if (objective === "support_inquiry") {
    return { ...base, maxWords: 16, askQuestion: true };
  }
  return base;
};

export const enforcePolicyOnAnswer = (answer = "", policy = {}) => {
  const text = String(answer || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sanitized = text
    .replace(/^(perfect|absolutely|of course)\.\s*(perfect|absolutely|of course)\./i, "$1.")
    .replace(/\b(and|or|but|so)\s*(\.)?$/i, "")
    .replace(/\b(the|a|an|to|of|for)\s*(\.)?$/i, "")
    .trim();

  const sentenceParts = sanitized.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [];
  const words = text.split(" ");
  const maxWords = Number(policy.maxWords || 18);
  if (words.length <= maxWords) return sanitized;

  let used = 0;
  const picked = [];
  for (const sentence of sentenceParts) {
    const count = sentence.split(/\s+/).filter(Boolean).length;
    if (!count) continue;
    if (used + count > maxWords) break;
    picked.push(sentence.replace(/[,.;:]+$/, "."));
    used += count;
  }

  if (picked.length) return picked.join(" ").replace(/\s+/g, " ").trim();
  const fallback = words.slice(0, maxWords).join(" ").replace(/[,.;:]+$/, "");
  return `${fallback}.`;
};
