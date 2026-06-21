export class LatencyManager {
  constructor(log = () => {}) {
    this.log = log;
  }

  mark(turn, key) {
    if (!turn || !key) return;
    turn[key] = Date.now();
  }

  emit(turn) {
    if (!turn) return;
    this.log("latency", {
      turnId: turn.turnId,
      llmFirstTokenMs:
        turn.llmStartedAt && turn.llmFirstTokenAt
          ? turn.llmFirstTokenAt - turn.llmStartedAt
          : null,
      ttsFirstChunkMs:
        turn.llmFirstTokenAt && turn.ttsFirstChunkAt
          ? turn.ttsFirstChunkAt - turn.llmFirstTokenAt
          : null,
      playbackStartMs:
        turn.ttsFirstChunkAt && turn.playbackStartedAt
          ? turn.playbackStartedAt - turn.ttsFirstChunkAt
          : null,
    });
  }
}

