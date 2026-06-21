const DEFAULT_STATE = Object.freeze({
  stage: "greeting",
  activeTopic: "",
  currentlyExplaining: false,
  unfinishedThought: false,
  userInterestLevel: "medium",
  interruptionCount: 0,
  previousQuestion: "",
  lastAIMessage: "",
  expectedNextAction: "discover",
  callGoal: "guide admission inquiry",
  lastIntent: "unknown",
  pendingContinuation: "",
  confidence: 0.6,
});

const clean = (value = "", max = 300) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

export class ConversationManager {
  constructor() {
    this.stateBySession = new Map();
  }

  get(sessionId) {
    if (!sessionId) return { ...DEFAULT_STATE };
    return this.stateBySession.get(sessionId) || { ...DEFAULT_STATE };
  }

  init(sessionId, patch = {}) {
    const next = { ...DEFAULT_STATE, ...patch };
    this.stateBySession.set(sessionId, next);
    return next;
  }

  update(sessionId, patch = {}) {
    const current = this.get(sessionId);
    const next = {
      ...current,
      ...patch,
      previousQuestion: clean(patch.previousQuestion ?? current.previousQuestion, 220),
      lastAIMessage: clean(patch.lastAIMessage ?? current.lastAIMessage, 700),
      pendingContinuation: clean(patch.pendingContinuation ?? current.pendingContinuation, 500),
      activeTopic: clean(patch.activeTopic ?? current.activeTopic, 120),
      expectedNextAction: clean(patch.expectedNextAction ?? current.expectedNextAction, 80),
      callGoal: clean(patch.callGoal ?? current.callGoal, 140),
      lastIntent: clean(patch.lastIntent ?? current.lastIntent, 80),
    };
    this.stateBySession.set(sessionId, next);
    return next;
  }

  markInterrupted(sessionId) {
    const current = this.get(sessionId);
    return this.update(sessionId, {
      interruptionCount: Number(current.interruptionCount || 0) + 1,
      unfinishedThought: true,
      currentlyExplaining: false,
      expectedNextAction: "recover_after_interruption",
    });
  }

  close(sessionId) {
    this.stateBySession.delete(sessionId);
  }
}

export const conversationManager = new ConversationManager();

