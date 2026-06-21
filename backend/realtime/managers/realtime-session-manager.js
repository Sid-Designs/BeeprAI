import { memoryContextEngine } from "../engines/memory-context-engine.js";
import { ConversationStates } from "../constants/events.js";

class RealtimeSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  create(callId, tenantId, agentId) {
    const existing = this.sessions.get(callId);
    if (existing) return existing;

    const session = {
      callId,
      tenantId,
      agentId,
      createdAt: Date.now(),
      currentState: ConversationStates.INIT,
      nextExpectedState: ConversationStates.GREETING,
      terminalObjective: "qualify",
      lastTurnAt: Date.now(),
      activeTurnOwner: "user",
      memory: memoryContextEngine.create(),
      transcript: [],
      metrics: {
        turnLatencyMs: [],
        interruptions: 0,
      },
    };

    this.sessions.set(callId, session);
    return session;
  }

  get(callId) {
    return this.sessions.get(callId) || null;
  }

  update(callId, patch = {}) {
    const current = this.get(callId);
    if (!current) return null;
    const merged = { ...current, ...patch, lastTurnAt: Date.now() };
    this.sessions.set(callId, merged);
    return merged;
  }

  end(callId) {
    const session = this.get(callId);
    this.sessions.delete(callId);
    return session;
  }
}

export const realtimeSessionManager = new RealtimeSessionManager();
