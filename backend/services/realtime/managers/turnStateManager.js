export class TurnStateManager {
  constructor() {
    this.turns = new Map();
  }

  init(turnId) {
    const state = {
      turnId,
      ttsStarted: false,
      llmStartedAt: 0,
      llmFirstTokenAt: 0,
      ttsFirstChunkAt: 0,
      playbackStartedAt: 0,
      cancelled: false,
    };
    this.turns.set(turnId, state);
    return state;
  }

  get(turnId) {
    return this.turns.get(turnId) || null;
  }

  cancel(turnId) {
    const s = this.get(turnId);
    if (!s) return;
    s.cancelled = true;
  }

  close(turnId) {
    this.turns.delete(turnId);
  }
}

