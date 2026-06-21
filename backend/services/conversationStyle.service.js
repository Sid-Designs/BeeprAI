import {
  polishVoiceResponse,
  stripRoboticPhrasing,
} from "./conversation/responsePolish.service.js";

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const BANNED_RE = [
  /let us take the next step/gi,
  /let us take the next best step/gi,
  /here is what we can do now/gi,
  /how may i assist you/gi,
  /could you elaborate/gi,
  /thank you for your patience/gi,
];

const SOFT_CLOSERS = [
  "Thanks for your time. Goodbye, take care.",
  "Glad I could help. Goodbye and take care.",
  "I appreciate your time. Goodbye.",
];

const pick = (list = [], seed = "") => {
  if (!list.length) return "";
  const key = String(seed || "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
};

const sanitizeBannedPhrases = (text = "") => {
  let cleaned = stripRoboticPhrasing(text);
  for (const re of BANNED_RE) {
    cleaned = cleaned.replace(re, "");
  }
  return normalizeText(cleaned);
};

export const applyConversationStyle = ({
  answer = "",
  userEmotion = "neutral",
  stage = "discovery",
  turnCount = 0,
  query = "",
  previousAiMessage = "",
  responseStyleProfile = {},
  skipPolish = false,
} = {}) => {
  let text = sanitizeBannedPhrases(normalizeText(answer));
  if (!text) return "";

  if (!skipPolish) {
    text = polishVoiceResponse({
      answer: text,
      query,
      previousAiMessage,
      turnCount,
      stage,
      userEmotion,
      responseStyleProfile,
    });
  }

  const stageName = String(stage || "").toLowerCase();
  const openingSeed = `${turnCount}:${text}`;
  const isSoftCloseOffer = /\b(anything else|before we close|one more thing)\b/i.test(text);

  if (stageName === "closing" && !isSoftCloseOffer && !/\b(goodbye|bye|see you|take care)\b/i.test(text)) {
    text = `${text} ${pick(SOFT_CLOSERS, openingSeed)}`;
  }

  return sanitizeBannedPhrases(text);
};
