const clean = (value = "", max = 600) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

export class CallMemoryStore {
  constructor() {
    this.map = new Map();
  }

  get(sessionId) {
    return this.map.get(sessionId) || {
      shortTerm: [],
      userFacts: {},
      discussedTopics: [],
      objections: [],
      emotionalSignals: [],
      unansweredQuestions: [],
      summary: "",
    };
  }

  update(sessionId, patch = {}) {
    const current = this.get(sessionId);
    const next = {
      ...current,
      ...patch,
      summary: clean(patch.summary ?? current.summary, 900),
    };
    this.map.set(sessionId, next);
    return next;
  }

  pushTurn(sessionId, role, text) {
    const current = this.get(sessionId);
    const shortTerm = [...(current.shortTerm || []), { role, text: clean(text, 300) }].slice(-16);
    return this.update(sessionId, { shortTerm });
  }

  close(sessionId) {
    this.map.delete(sessionId);
  }
}

export const callMemoryStore = new CallMemoryStore();

