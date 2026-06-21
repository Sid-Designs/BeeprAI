const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const ROBOTIC_PHRASE_RE = [
  /\b(designed for|intended for|aimed at)\s+students\b/gi,
  /\b(postgraduate degree program|undergraduate degree program)\b/gi,
  /\b(i would be happy to|i'd be happy to|please be advised)\b/gi,
  /\b(furthermore|moreover|additionally|in addition to that)\b/gi,
  /\b(as an ai|as a language model)\b/gi,
  /\b(certainly|absolutely|of course),?\s+(certainly|absolutely|of course)\b/gi,
  /\b(i can help you with that)\b/gi,
  /\b(thank you for reaching out)\b/gi,
  /\b(is there anything else i can assist you with)\b/gi,
];

const OVERUSED_OPENERS = [
  /^sure[!,. ]*/i,
  /^certainly[!,. ]*/i,
  /^absolutely[!,. ]*/i,
  /^of course[!,. ]*/i,
  /^i can help with that[!,. ]*/i,
  /^great[!,. ]*/i,
  /^perfect[!,. ]*/i,
  /^hello[!,. ]*/i,
];

const VARIED_ACKS = [
  "Right.",
  "Got it.",
  "Okay.",
  "Understood.",
  "That makes sense.",
  "Good question.",
];

const VARIED_WARM_ACKS = [
  "Sure.",
  "Of course.",
  "Happy to explain.",
  "Let me explain.",
];

const EMPATHY_ACKS = [
  "I understand.",
  "I hear you.",
  "That's fair.",
];

const pick = (list = [], seed = "") => {
  if (!list.length) return "";
  let hash = 0;
  const key = String(seed || "");
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
};

const FACTUAL_QUERY_RE =
  /\b(fee|fees|price|cost|eligib|admission|process|course|program|duration|deadline|scholarship|placement)\b/i;

const COMPLEX_QUERY_RE =
  /\b(compare|difference|explain|how does|walk me through|step by step|pros and cons|options)\b/i;

export const resolveWordBudget = ({
  query = "",
  responseStyleProfile = {},
  stage = "discovery",
} = {}) => {
  const base = Number(responseStyleProfile?.wordBudget || 24);
  const text = normalizeText(query);
  const stageName = String(stage || "").toLowerCase();

  if (responseStyleProfile?.mode === "concise") return Math.min(base, 18);
  if (responseStyleProfile?.mode === "explain" || COMPLEX_QUERY_RE.test(text)) {
    return Math.min(42, Math.max(base, 32));
  }
  if (FACTUAL_QUERY_RE.test(text) && text.split(" ").length <= 12) {
    return Math.min(34, Math.max(base, 26));
  }
  if (stageName === "closing" || stageName === "completed") return Math.min(base, 18);
  return base;
};

export const stripRoboticPhrasing = (text = "") => {
  let value = normalizeText(text);
  for (const pattern of ROBOTIC_PHRASE_RE) {
    value = value.replace(pattern, "");
  }
  value = value
    .replace(/\bprogram is a\b/gi, "is a")
    .replace(/\bthe mca program\b/gi, "MCA")
    .replace(/\bthe mba program\b/gi, "MBA")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
  return value;
};

const BOOKING_CONTENT_RE =
  /\b(appointment|availability|slot|book(?:ing)?|schedule|counselou?r|open for your|which works best|checking appointment)\b/i;

export const diversifyOpener = ({
  text = "",
  turnCount = 0,
  userEmotion = "neutral",
  previousAiMessage = "",
} = {}) => {
  let value = normalizeText(text);
  if (!value) return "";

  const prevOpener = normalizeText(previousAiMessage).split(/[.!?]/)[0] || "";
  let stripped = value;
  for (const pattern of OVERUSED_OPENERS) {
    stripped = stripped.replace(pattern, "");
  }
  stripped = normalizeText(stripped);
  if (!stripped) stripped = value;

  const seed = `${turnCount}:${userEmotion}:${value.slice(0, 40)}`;
  const emotion = String(userEmotion || "neutral").toLowerCase();
  const hasDevanagari = DEVANAGARI_RE.test(value);
  let opener = "";

  if (hasDevanagari) {
    return stripped;
  }

  if (BOOKING_CONTENT_RE.test(stripped)) {
    return stripped;
  }

  if (emotion === "frustrated" || emotion === "confused") {
    opener = pick(EMPATHY_ACKS, seed);
  } else if (FACTUAL_QUERY_RE.test(value) || FACTUAL_QUERY_RE.test(stripped)) {
    opener = "";
  } else if (turnCount > 1) {
    opener = pick(VARIED_ACKS, seed);
  } else {
    opener = pick(VARIED_WARM_ACKS, seed);
  }

  if (opener && prevOpener && opener.toLowerCase() === prevOpener.toLowerCase().slice(0, opener.length)) {
    opener = pick([...VARIED_ACKS, ...VARIED_WARM_ACKS], `${seed}:alt`);
  }

  if (!opener) return stripped;
  if (/^(right|got it|okay|understood|sure|i understand|good question)/i.test(stripped)) {
    return stripped;
  }
  return `${opener} ${stripped}`.replace(/\s+/g, " ").trim();
};

export const enforceVoiceFriendly = (text = "") => {
  let value = normalizeText(text);
  if (!value) return "";
  if (DEVANAGARI_RE.test(value)) {
    return value.replace(/\s+/g, " ").trim();
  }

  value = value.replace(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/gi, (_, hour, minute, meridiem) => {
    const suffix = meridiem ? ` ${meridiem.toUpperCase()}` : "";
    return `${hour}<TIME_COLON>${minute}${suffix}`;
  });

  value = value
    .replace(/\s*[-–—]\s*/g, ", ")
    .replace(/\b(e\.g\.|i\.e\.|etc\.)\b/gi, "")
    .replace(/\(\s*[^)]{1,80}\s*\)/g, "")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\s*:\s*/g, ", ")
    .replace(/(\d)\.(\d)/g, "$1<DEC>$2")
    .replace(/<TIME_COLON>/g, ":")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = value.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [value];
  const trimmed = sentences.slice(0, 4).map((sentence) => {
    const restored = sentence.replace(/<DEC>/g, ".");
    const words = restored.split(/\s+/).filter(Boolean);
    if (words.length <= 22) {
      return restored.replace(/[.!?]+$/, "").trim() + (restored.includes("?") ? "?" : ".");
    }
    return `${words.slice(0, 22).join(" ").replace(/[,.;:]+$/, "")}.`;
  });

  return trimmed.join(" ").replace(/<DEC>/g, ".").replace(/\s+/g, " ").trim();
};

export const avoidRepeatingPriorAnswer = ({
  text = "",
  previousAiMessage = "",
} = {}) => {
  const current = normalizeText(text).toLowerCase();
  const previous = normalizeText(previousAiMessage).toLowerCase();
  if (!current || !previous) return normalizeText(text);

  if (current.length > 20 && previous.includes(current.slice(0, Math.min(60, current.length)))) {
    return normalizeText(text);
  }
  return normalizeText(text);
};

export const enforceOneQuestion = (text = "") => {
  const value = normalizeText(text);
  if (!value) return "";
  const parts = value.split("?");
  if (parts.length <= 2) return value;
  const firstQ = `${parts[0].replace(/[.!,;:\s]+$/g, "").trim()}?`;
  const rest = parts.slice(1).join(" ").replace(/\?/g, ".").trim();
  return rest ? `${firstQ} ${rest}`.trim() : firstQ;
};

const DANGLING_TAIL_WORD_RE =
  /^(and|or|but|the|a|an|to|for|with|are|is|am|was|were|be|your|my|our|their|that|this|which|what|when|where|how|who|open|offer|checking|isn't|aren't|wasn't|i'm)$/i;

export const enforceWordCap = (text = "", cap = 28) => {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= cap) return normalized;

  const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length) {
    let kept = "";
    for (const sentence of sentences) {
      const candidate = kept ? `${kept} ${sentence.trim()}`.trim() : sentence.trim();
      const candidateWords = candidate.split(/\s+/).filter(Boolean).length;
      if (candidateWords <= cap) {
        kept = candidate;
      } else {
        break;
      }
    }
    if (kept) return kept.trim();
  }

  const slice = words.slice(0, cap);
  while (slice.length && DANGLING_TAIL_WORD_RE.test(slice[slice.length - 1])) {
    slice.pop();
  }
  if (!slice.length) return `${words.slice(0, cap).join(" ")}.`;
  const joined = slice.join(" ").replace(/[,.;:–—-]+$/g, "").trim();
  if (!joined) return "";
  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
};

export const polishVoiceResponse = ({
  answer = "",
  query = "",
  previousAiMessage = "",
  turnCount = 0,
  stage = "discovery",
  userEmotion = "neutral",
  responseStyleProfile = {},
} = {}) => {
  const wordBudget = resolveWordBudget({ query, responseStyleProfile, stage });

  let text = stripRoboticPhrasing(answer);
  if (!/\b(before we close|anything else i can help)\b/i.test(text)) {
    text = avoidRepeatingPriorAnswer({ text, previousAiMessage });
    text = diversifyOpener({ text, turnCount, userEmotion, previousAiMessage });
  }
  text = enforceVoiceFriendly(text);
  text = enforceOneQuestion(text);
  text = enforceWordCap(text, wordBudget);
  return normalizeText(text);
};

export const buildConversationContextBlock = ({
  callState = {},
  history = [],
  turnDirective = null,
} = {}) => {
  const collected = callState?.collectedData || {};
  const known = [];
  if (collected.course) known.push(`course=${collected.course}`);
  if (collected.name) known.push(`name=${collected.name}`);
  if (collected.timeline || collected.preferred_date) {
    known.push(`timeline=${collected.timeline || collected.preferred_date}`);
  }
  if (collected.preferred_time) known.push(`time=${collected.preferred_time}`);

  const recentUser = (Array.isArray(history) ? history : [])
    .filter((m) => m?.role === "user")
    .slice(-3)
    .map((m) => normalizeText(m.content))
    .filter(Boolean);

  const lastAssistant = (Array.isArray(history) ? history : [])
    .filter((m) => m?.role === "assistant")
    .slice(-1)
    .map((m) => normalizeText(m.content))
    .join(" ");

  return `
CONVERSATION MEMORY (use, do not repeat):
- stage: ${normalizeText(callState?.stage || turnDirective?.stage || "discovery")}
- user intent: ${normalizeText(callState?.userIntent?.intent || turnDirective?.intent || "unknown")}
- already collected: ${known.length ? known.join(", ") : "none yet"}
- recent user topics: ${recentUser.length ? recentUser.join(" | ") : "none"}
- your last reply: ${lastAssistant || "none"}
- do not re-introduce yourself
- do not repeat facts from your last reply unless the user asks again
`.trim();
};
