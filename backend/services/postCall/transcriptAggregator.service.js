const cleanText = (value = "", max = 2000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const normalizeRole = (role = "") => {
  const value = cleanText(role, 20).toLowerCase();
  if (value === "user" || value === "caller" || value === "customer") return "user";
  if (value === "assistant" || value === "agent" || value === "ai") return "assistant";
  return "";
};

const normalizeMessageList = (messages = []) => {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = normalizeRole(item.role || item.speaker);
      const content = cleanText(item.content || item.message || item.text, 2000);
      if (!role || !content) return null;
      return { role, content };
    })
    .filter(Boolean);
};

export const mergeTranscriptSources = (...sources) => {
  let best = [];

  for (const source of sources) {
    const normalized = normalizeMessageList(source);
    if (normalized.length > best.length) {
      best = normalized;
    }
  }

  return best;
};

export const buildStructuredTranscript = ({
  messages = [],
  startTime = null,
  endTime = null,
} = {}) => {
  const turns = normalizeMessageList(messages);
  if (!turns.length) return [];

  const startMs = startTime ? new Date(startTime).getTime() : Date.now() - turns.length * 4000;
  const endMs = endTime ? new Date(endTime).getTime() : Date.now();
  const spanMs = Math.max(endMs - startMs, turns.length * 2500);
  const stepMs = Math.max(Math.floor(spanMs / turns.length), 1500);

  return turns.map((turn, index) => ({
    speaker: turn.role,
    timestamp: new Date(startMs + stepMs * index),
    message: turn.content,
    turnIndex: index + 1,
  }));
};

export const formatTranscriptForLLM = (transcript = []) => {
  if (!Array.isArray(transcript) || !transcript.length) return "No conversation transcript available.";

  return transcript
    .map((turn) => {
      const speaker = turn.speaker === "user" ? "Caller" : "Agent";
      const text = cleanText(turn.message, 1200);
      return `${speaker}: ${text}`;
    })
    .join("\n");
};

export const extractPhoneFromIdentity = (identity = "") => {
  const raw = cleanText(identity, 80);
  if (!raw) return "";

  const stripped = raw.replace(/^sip[_:]/i, "").replace(/[^\d+]/g, "");
  if (stripped.length >= 8) return stripped;
  return "";
};
