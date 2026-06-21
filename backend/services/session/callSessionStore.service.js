import {
  connectRedis,
  getRedisClient,
  isRedisConnected,
  isRedisConfigured,
  sessionKey,
  SESSION_TTL_SECONDS,
} from "../../config/redis.js";

const localStore = new Map();
const hydrationInFlight = new Map();

export const createDefaultSession = () => ({
  messages: [],
  lastContext: "",
  lastIntent: "",
  lastIntentData: null,
  callState: null,
  answerCache: [],
  customerProfile: null,
  compactSummary: "",
});

const parseJson = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const getLocalSession = (sessionId) => {
  if (!sessionId) return createDefaultSession();
  if (!localStore.has(sessionId)) {
    localStore.set(sessionId, createDefaultSession());
  }
  return localStore.get(sessionId);
};

const persistSession = async (sessionId) => {
  const redis = getRedisClient();
  const session = localStore.get(sessionId);
  if (!redis || !session || !sessionId) return;

  const ttl = Math.max(60, SESSION_TTL_SECONDS);
  await redis
    .multi()
    .set(sessionKey(sessionId, "messages"), JSON.stringify(session.messages || []), "EX", ttl)
    .set(
      sessionKey(sessionId, "callState"),
      JSON.stringify(session.callState ?? null),
      "EX",
      ttl,
    )
    .set(sessionKey(sessionId, "context"), String(session.lastContext || ""), "EX", ttl)
    .set(
      sessionKey(sessionId, "extras"),
      JSON.stringify({
        lastIntent: session.lastIntent || "",
        lastIntentData: session.lastIntentData ?? null,
        answerCache: session.answerCache || [],
        customerProfile: session.customerProfile ?? null,
        compactSummary: session.compactSummary || "",
      }),
      "EX",
      ttl,
    )
    .exec();
};

const hydrateFromRedis = async (sessionId) => {
  const redis = getRedisClient();
  if (!redis || !sessionId) return;

  const [messagesRaw, callStateRaw, contextRaw, extrasRaw] = await redis.mget(
    sessionKey(sessionId, "messages"),
    sessionKey(sessionId, "callState"),
    sessionKey(sessionId, "context"),
    sessionKey(sessionId, "extras"),
  );

  if (!messagesRaw && !callStateRaw && !contextRaw && !extrasRaw) return;

  const extras = parseJson(extrasRaw, {});
  localStore.set(sessionId, {
    messages: parseJson(messagesRaw, []),
    lastContext: typeof contextRaw === "string" ? contextRaw : "",
    lastIntent: extras.lastIntent || "",
    lastIntentData: extras.lastIntentData ?? null,
    callState: parseJson(callStateRaw, null),
    answerCache: Array.isArray(extras.answerCache) ? extras.answerCache : [],
    customerProfile: extras.customerProfile ?? null,
    compactSummary: extras.compactSummary || "",
  });
};

export const initCallSessionStore = async () => {
  if (!isRedisConfigured()) {
    console.log("[session-store] redis disabled, using in-memory call sessions");
    return { mode: "memory" };
  }
  const ok = await connectRedis();
  return { mode: ok ? "redis" : "memory" };
};

export const ensureSessionHydrated = async (sessionId) => {
  if (!sessionId) return;
  if (localStore.has(sessionId)) return;
  if (!isRedisConnected()) {
    getLocalSession(sessionId);
    return;
  }
  if (hydrationInFlight.has(sessionId)) {
    await hydrationInFlight.get(sessionId);
    return;
  }

  const task = hydrateFromRedis(sessionId).finally(() => {
    hydrationInFlight.delete(sessionId);
    if (!localStore.has(sessionId)) {
      getLocalSession(sessionId);
    }
  });
  hydrationInFlight.set(sessionId, task);
  await task;
};

export const saveSession = (sessionId, session) => {
  if (!sessionId || !session) return;
  localStore.set(sessionId, { ...createDefaultSession(), ...session });
  void persistSession(sessionId).catch((error) => {
    console.warn("[session-store] persist failed:", error?.message || error);
  });
};

export const readSession = (sessionId) => getLocalSession(sessionId);

export const updateSession = (sessionId, updater) => {
  const current = getLocalSession(sessionId);
  const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  saveSession(sessionId, next);
  return next;
};

export const clearSessionForTests = (sessionId) => {
  localStore.delete(sessionId);
  hydrationInFlight.delete(sessionId);
};

export const getSessionStoreMode = () => (isRedisConnected() ? "redis" : "memory");
