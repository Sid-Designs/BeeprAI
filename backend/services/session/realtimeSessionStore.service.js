import Redis from "ioredis";

const DEFAULT_TTL_SECONDS = Number.parseInt(process.env.RT_SESSION_TTL_SECONDS || "7200", 10);
const REDIS_ENABLED = String(process.env.REDIS_ENABLED || "false").toLowerCase() === "true";

const hasRedisConfig = REDIS_ENABLED && Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

const buildRedisClient = () => {
  if (!hasRedisConfig) return null;
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

class RealtimeSessionStore {
  constructor() {
    this.memory = new Map();
    this.redis = buildRedisClient();
    this.connected = false;
  }

  async connect() {
    if (!this.redis || this.connected) return;
    try {
      this.redis.on("error", () => {
        // Prevent noisy unhandled ioredis error logs when redis is unavailable.
      });
      await this.redis.connect();
      this.connected = true;
      console.log("[session-store] redis connected");
    } catch (error) {
      this.connected = false;
      try {
        this.redis.disconnect(false);
      } catch {
        // ignore cleanup errors
      }
      this.redis = null;
      console.warn("[session-store] redis unavailable, fallback to memory:", error.message);
    }
  }

  key(callId) {
    return `rt:session:${callId}`;
  }

  createSession(payload = {}) {
    const now = Date.now();
    return {
      callId: String(payload.callId || ""),
      tenantId: String(payload.tenantId || ""),
      agentId: String(payload.agentId || ""),
      roomId: String(payload.roomId || ""),
      callerNumber: String(payload.callerNumber || ""),
      conversationHistory: [],
      transcript: {
        user: [],
        assistant: [],
      },
      emotionalContext: {
        userEmotion: "neutral",
        aiTone: "calm",
      },
      speakingState: {
        userSpeaking: false,
        assistantSpeaking: false,
      },
      interruptionState: {
        interrupted: false,
        count: 0,
      },
      silence: {
        activeMs: 0,
        lastSpeechAt: now,
      },
      memory: {
        shortTerm: {},
        intents: [],
        extractedDetails: {},
        summary: "",
      },
      metrics: {
        latencies: {
          wsRoundtripMs: [],
          modelFirstTokenMs: [],
          ttsSynthesisMs: [],
          totalTurnMs: [],
        },
        tokenUsage: {
          input: 0,
          output: 0,
          total: 0,
        },
        gating: {
          totalTurns: 0,
          modelTurns: 0,
          cachedTurns: 0,
          templateTurns: 0,
          skippedTurns: 0,
        },
        interruptions: 0,
        silenceDurationMs: 0,
        errors: 0,
      },
      timestamps: {
        createdAt: now,
        updatedAt: now,
        closedAt: 0,
      },
    };
  }

  async set(callId, data, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const key = this.key(callId);
    const payload = {
      ...(data || {}),
      timestamps: {
        ...(data?.timestamps || {}),
        updatedAt: Date.now(),
      },
    };

    this.memory.set(callId, payload);
    if (this.connected && this.redis) {
      await this.redis.set(key, JSON.stringify(payload), "EX", ttlSeconds);
    }
    return payload;
  }

  async get(callId) {
    if (!callId) return null;
    if (this.memory.has(callId)) return this.memory.get(callId);

    if (this.connected && this.redis) {
      const raw = await this.redis.get(this.key(callId));
      if (raw) {
        const parsed = JSON.parse(raw);
        this.memory.set(callId, parsed);
        return parsed;
      }
    }
    return null;
  }

  async upsert(callId, patch = {}) {
    const current = (await this.get(callId)) || this.createSession({ callId });
    const next = {
      ...current,
      ...patch,
      transcript: {
        ...(current.transcript || {}),
        ...(patch.transcript || {}),
      },
      emotionalContext: {
        ...(current.emotionalContext || {}),
        ...(patch.emotionalContext || {}),
      },
      speakingState: {
        ...(current.speakingState || {}),
        ...(patch.speakingState || {}),
      },
      interruptionState: {
        ...(current.interruptionState || {}),
        ...(patch.interruptionState || {}),
      },
      silence: {
        ...(current.silence || {}),
        ...(patch.silence || {}),
      },
      memory: {
        ...(current.memory || {}),
        ...(patch.memory || {}),
      },
      metrics: {
        ...(current.metrics || {}),
        ...(patch.metrics || {}),
      },
    };
    return this.set(callId, next);
  }

  async close(callId) {
    const session = await this.get(callId);
    if (!session) return null;
    const closed = {
      ...session,
      timestamps: {
        ...(session.timestamps || {}),
        updatedAt: Date.now(),
        closedAt: Date.now(),
      },
    };
    await this.set(callId, closed, 300);
    return closed;
  }

  async delete(callId) {
    this.memory.delete(callId);
    if (this.connected && this.redis) {
      await this.redis.del(this.key(callId));
    }
  }
}

export const realtimeSessionStore = new RealtimeSessionStore();
