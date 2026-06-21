const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const HINDI_TOKENS = [
  "aap",
  "mujhe",
  "main",
  "hum",
  "tum",
  "kya",
  "kaise",
  "hai",
  "hain",
  "nahi",
  "haan",
  "kripya",
  "samjha",
  "samjhao",
  "chahiye",
  "chahie",
  "hoga",
  "hogi",
  "bataye",
  "batao",
  "batado",
  "karna",
  "karni",
  "karo",
  "kar",
  "dena",
  "bilkul",
  "thik",
  "theek",
  "achha",
  "accha",
  "ji",
  "kal",
  "par",
  "liye",
  "mein",
  "mere",
];

const MARATHI_TOKENS = [
  "mala",
  "tumhala",
  "tumhi",
  "kay",
  "kaay",
  "kasa",
  "nahi",
  "aahe",
  "ahe",
  "sanga",
  "mahiti",
  "ghyaycha",
  "ghyaychi",
  "ghya",
  "hota",
  "hoti",
  "hou",
  "shakta",
  "shakte",
  "karu",
  "karnyasathi",
  "tar",
  "tari",
  "madhe",
  "sathi",
  "udya",
  "aaj",
];

const LANGUAGE_CODE_TO_KEY = Object.freeze({
  en: "en",
  english: "en",
  hi: "hi",
  hindi: "hi",
  mr: "mr",
  marathi: "mr",
});

const toLanguageKey = (value, fallback = "en") =>
  LANGUAGE_CODE_TO_KEY[String(value || "").toLowerCase()] || fallback;

const countMatches = (textLower, list = []) =>
  list.reduce((count, token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(textLower) ? count + 1 : count;
  }, 0);

const detectExplicitLanguageChoice = (textLower = "") => {
  if (
    /\b(speak in marathi|marathi madhe|marathi\b|मराठीत|मराठीत)\b/.test(textLower)
  ) return "mr";
  if (
    /\b(speak in hindi|hindi mein|hindi\b|हिंदी में|हिंदी)\b/.test(textLower)
  ) return "hi";
  if (
    /\b(speak in english|english please|english\b)\b/.test(textLower)
  ) return "en";
  return "";
};

export const resolveLanguageConfig = (callConfig = {}) => {
  const langConfig = callConfig?.languageConfig && typeof callConfig.languageConfig === "object"
    ? callConfig.languageConfig
    : {};
  const allowed = Array.isArray(langConfig.allowedLanguages) && langConfig.allowedLanguages.length
    ? langConfig.allowedLanguages.map((item) => toLanguageKey(item)).filter(Boolean)
    : ["en", "hi", "mr"];
  const allowedSet = new Set(allowed);
  const startLanguage = allowedSet.has(toLanguageKey(langConfig.startLanguage, "en"))
    ? toLanguageKey(langConfig.startLanguage, "en")
    : allowed[0] || "en";

  return {
    startLanguage,
    allowedLanguages: [...allowedSet],
    allowCodeMix: langConfig.allowCodeMix !== false,
    style: String(langConfig.style || "mirror_user"),
  };
};

export const getInitialLanguageState = (languageConfig) => ({
  startLanguage: languageConfig.startLanguage,
  dominantLanguage: languageConfig.startLanguage,
  mixLevel: "low",
  userLanguageByTurn: [],
});

export const detectLanguageProfile = ({
  query = "",
  previousState = {},
  languageConfig,
} = {}) => {
  const text = normalizeText(query);
  const lower = text.toLowerCase();
  const allowed = languageConfig?.allowedLanguages || ["en", "hi", "mr"];
  const allowedSet = new Set(allowed);

  const hindiHits = countMatches(lower, HINDI_TOKENS);
  const marathiHits = countMatches(lower, MARATHI_TOKENS);
  const hasDevanagari = DEVANAGARI_RE.test(text);
  const englishWords = lower.split(" ").filter((w) => /^[a-z]+$/.test(w)).length;
  const totalWords = Math.max(lower.split(" ").filter(Boolean).length, 1);

  let dominant = previousState?.dominantLanguage || languageConfig?.startLanguage || "en";
  const explicitLanguage = detectExplicitLanguageChoice(lower);
  const lockTurnsRemaining = Number(previousState?.lockTurnsRemaining || 0);

  if (explicitLanguage && allowedSet.has(explicitLanguage)) {
    dominant = explicitLanguage;
  } else if (lockTurnsRemaining > 0 && allowedSet.has(previousState?.lockedLanguage)) {
    dominant = previousState.lockedLanguage;
  } else if (hasDevanagari) {
    dominant = marathiHits >= hindiHits ? "mr" : "hi";
  } else if (marathiHits >= 1 && marathiHits > hindiHits) {
    dominant = "mr";
  } else if (hindiHits >= 1 && hindiHits >= marathiHits) {
    const mostlyEnglish = englishWords / totalWords > 0.7;
    if (hindiHits >= 2 || !mostlyEnglish || dominant === "hi") {
      dominant = "hi";
    }
  } else if (marathiHits === 1 && hindiHits === 0 && englishWords / totalWords < 0.55) {
    dominant = "mr";
  } else if (englishWords / totalWords > 0.65) {
    dominant = "en";
  }

  const prevDominant = previousState?.dominantLanguage || languageConfig?.startLanguage || "en";
  const switchedToIndic =
    (dominant === "hi" || dominant === "mr") && dominant !== prevDominant;

  if (!allowedSet.has(dominant)) {
    dominant = languageConfig?.startLanguage || "en";
  }

  const nonDominantHits =
    dominant === "en" ? hindiHits + marathiHits : englishWords > 0 ? 1 : 0;
  const ratio = nonDominantHits / Math.max(totalWords, 1);
  const mixLevel = ratio > 0.35 ? "high" : ratio > 0.15 ? "medium" : "low";

  const nextState = {
    ...(previousState && typeof previousState === "object" ? previousState : {}),
    startLanguage: previousState?.startLanguage || languageConfig?.startLanguage || "en",
    dominantLanguage: dominant,
    mixLevel,
    lockedLanguage:
      explicitLanguage && allowedSet.has(explicitLanguage)
        ? explicitLanguage
        : switchedToIndic || hasDevanagari || marathiHits >= 1 || hindiHits >= 1
          ? dominant
          : previousState?.lockedLanguage || "",
    lockTurnsRemaining:
      explicitLanguage && allowedSet.has(explicitLanguage)
        ? 4
        : switchedToIndic || hasDevanagari || marathiHits >= 1 || hindiHits >= 1
          ? 3
          : Math.max(lockTurnsRemaining - 1, 0),
    userLanguageByTurn: [...(previousState?.userLanguageByTurn || []), dominant].slice(-12),
  };

  return nextState;
};

export const formatTextForSpeech = (text = "", language = "en") => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value;
};

export const getLanguageInstruction = ({
  languageState = {},
  languageConfig = {},
  conversationState = {},
} = {}) => {
  const dominant = languageState?.dominantLanguage || languageConfig?.startLanguage || "en";
  const mixLevel = languageState?.mixLevel || "low";
  const allowMix = languageConfig?.allowCodeMix !== false;
  const userEmotion = String(conversationState?.userEmotion || "neutral");

  return {
    responseLanguage: dominant,
    promptBlock: `
LANGUAGE STYLE POLICY:
- Start language: ${languageConfig?.startLanguage || "en"}
- Dominant user language this turn: ${dominant}
- Mix level: ${mixLevel}
- Allowed languages: ${(languageConfig?.allowedLanguages || ["en", "hi", "mr"]).join(", ")}
- Mirror user style naturally. Avoid textbook-pure language.
- Use natural spoken code-mix when appropriate.
- If dominant language is Marathi or Hindi, reply fully in that language for TTS clarity.
- If user emotion is frustrated/urgent, keep wording clearer and less mixed.
- Switch language within one turn when user clearly shifts (Marathi/Hindi/English words or script).
- Keep speech TTS-friendly: short sentences, clean punctuation, no markdown symbols.
- If dominant language is Marathi or Hindi, prefer native script output for better pronunciation.
`,
    shouldCodeMix: allowMix && mixLevel !== "low" && userEmotion !== "urgent",
  };
};
