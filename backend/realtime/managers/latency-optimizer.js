import { CALL_EVENTS } from "../constants/events.js";

export class LatencyOptimizer {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.maxTurnMs = 2000;
  }

  computeTurnLatency(startTs) {
    const ms = Date.now() - startTs;
    if (ms > this.maxTurnMs) {
      this.eventBus.publish(CALL_EVENTS.LATENCY_WARNING, { latencyMs: ms, targetMs: this.maxTurnMs });
    }
    return ms;
  }

  hints() {
    return {
      streamingStt: true,
      streamingLlm: true,
      streamingTts: true,
      speculativeGeneration: true,
      chunkTtsPlayback: true,
      adaptiveEndpointing: true,
      silencePrediction: true,
      earlyTranscriptFinalization: true,
    };
  }
}
