import {
  ensureSessionHydrated,
  initCallSessionStore,
  readSession,
  saveSession,
  updateSession,
  createDefaultSession,
  clearSessionForTests,
  getSessionStoreMode,
} from "./session/callSessionStore.service.js";

export {
  initCallSessionStore,
  ensureSessionHydrated,
  clearSessionForTests,
  getSessionStoreMode,
  createDefaultSession,
};

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];

  return messages.filter(
    (msg) =>
      msg &&
      (msg.role === "user" || msg.role === "assistant") &&
      typeof msg.content === "string",
  );
};

export const getSessionMessages = (sessionId) => {
  if (!sessionId) return [];
  return normalizeMessages(readSession(sessionId).messages);
};

export const addMessageToSession = (sessionId, role, content) => {
  if (!sessionId || !role || typeof content !== "string") return;

  updateSession(sessionId, (session) => {
    const messages = normalizeMessages(session.messages);
    messages.push({ role, content });
    return { ...session, messages: messages.slice(-30) };
  });
};

export const getSessionContext = (sessionId) => {
  if (!sessionId) return "";
  const session = readSession(sessionId);
  return typeof session.lastContext === "string" ? session.lastContext : "";
};

export const setSessionContext = (sessionId, context) => {
  if (!sessionId || typeof context !== "string") return;
  updateSession(sessionId, (session) => ({ ...session, lastContext: context }));
};

export const getSessionIntent = (sessionId) => {
  if (!sessionId) return "";
  const session = readSession(sessionId);
  return typeof session.lastIntent === "string" ? session.lastIntent : "";
};

export const setSessionIntent = (sessionId, intent) => {
  if (!sessionId || typeof intent !== "string") return;
  updateSession(sessionId, (session) => ({ ...session, lastIntent: intent }));
};

export const getSessionIntentData = (sessionId) => {
  if (!sessionId) return null;
  return readSession(sessionId).lastIntentData || null;
};

export const setSessionIntentData = (sessionId, intentData) => {
  if (!sessionId || !intentData) return;
  updateSession(sessionId, (session) => ({ ...session, lastIntentData: intentData }));
};

export const getSessionCallState = (sessionId) => {
  if (!sessionId) return null;
  return readSession(sessionId).callState || null;
};

export const setSessionCallState = (sessionId, callState) => {
  if (!sessionId || !callState || typeof callState !== "object") return;
  updateSession(sessionId, (session) => ({ ...session, callState }));
};

const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeKey = (value = "") => normalizeText(value).toLowerCase();

export const getCachedAnswer = (sessionId, query) => {
  if (!sessionId) return "";
  const key = normalizeKey(query);
  if (!key) return "";
  const cache = Array.isArray(readSession(sessionId).answerCache)
    ? readSession(sessionId).answerCache
    : [];
  const match = cache.find((item) => item?.key === key);
  return typeof match?.answer === "string" ? match.answer : "";
};

export const cacheSessionAnswer = (sessionId, query, answer) => {
  if (!sessionId) return;
  const key = normalizeKey(query);
  const normalizedAnswer = normalizeText(answer);
  if (!key || !normalizedAnswer) return;

  updateSession(sessionId, (session) => {
    const cache = Array.isArray(session.answerCache) ? session.answerCache : [];
    const filtered = cache.filter((item) => item?.key !== key);
    return {
      ...session,
      answerCache: [
        { key, answer: normalizedAnswer, updatedAt: Date.now() },
        ...filtered,
      ].slice(0, 40),
    };
  });
};

export const getSessionCustomerProfile = (sessionId) => {
  if (!sessionId) return null;
  return readSession(sessionId).customerProfile || null;
};

export const setSessionCustomerProfile = (sessionId, profile) => {
  if (!sessionId || !profile || typeof profile !== "object") return;
  updateSession(sessionId, (session) => ({ ...session, customerProfile: profile }));
};

export const getSessionCompactSummary = (sessionId) => {
  if (!sessionId) return "";
  const session = readSession(sessionId);
  return typeof session.compactSummary === "string" ? session.compactSummary : "";
};

export const setSessionCompactSummary = (sessionId, summary) => {
  if (!sessionId || typeof summary !== "string") return;
  updateSession(sessionId, (session) => ({
    ...session,
    compactSummary: normalizeText(summary).slice(0, 900),
  }));
};
