import Redis from "ioredis";

export const REDIS_ENABLED =
  String(process.env.REDIS_ENABLED || "false").toLowerCase() === "true";

export const SESSION_TTL_SECONDS = Number.parseInt(
  process.env.SESSION_TTL_SECONDS || "86400",
  10,
);

export const isRedisConfigured = () =>
  REDIS_ENABLED && Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

let client = null;
let connected = false;

const buildClient = () => {
  if (!isRedisConfigured()) return null;

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST,
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || "0", 10),
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    maxRetriesPerRequest: null,
    enableAutoPipelining: true,
  });
};

export const connectRedis = async () => {
  if (connected) return true;
  if (!isRedisConfigured()) return false;

  client = buildClient();
  if (!client) return false;

  try {
    client.on("error", () => {
      // Avoid unhandled ioredis error spam when Redis is unavailable.
    });
    await client.connect();
    connected = true;
    console.log("[redis] connected");
    return true;
  } catch (error) {
    connected = false;
    try {
      client.disconnect(false);
    } catch {
      // ignore cleanup errors
    }
    client = null;
    console.warn("[redis] unavailable, using in-memory session fallback:", error.message);
    return false;
  }
};

export const getRedisClient = () => (connected && client ? client : null);

export const isRedisConnected = () => connected;

export const closeRedis = async () => {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch {
      // ignore
    }
  } finally {
    client = null;
    connected = false;
  }
};

export const sessionKey = (sessionId, suffix) => `session:${sessionId}:${suffix}`;
