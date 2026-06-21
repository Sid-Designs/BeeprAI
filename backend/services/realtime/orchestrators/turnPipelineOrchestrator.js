import { PlaybackQueue } from "../queues/playbackQueue.js";
import { TurnStateManager } from "../managers/turnStateManager.js";
import { LatencyManager } from "../managers/latencyManager.js";
import { splitSemanticChunksWithFastStart } from "../../conversation/streamingResponseController.service.js";

export class TurnPipelineOrchestrator {
  constructor({
    log,
    synthesize,
    play,
    openStream,
    playStream,
    isTurnActive,
    onChunkStart,
    onChunkDone,
  } = {}) {
    this.log = log || (() => {});
    this.synthesize = synthesize;
    this.play = play;
    this.openStream = openStream;
    this.playStream = playStream;
    this.isTurnActive = isTurnActive || (() => true);
    this.onChunkStart = onChunkStart || (() => {});
    this.onChunkDone = onChunkDone || (() => {});
    this.turnState = new TurnStateManager();
    this.playbackQueue = new PlaybackQueue();
    this.latency = new LatencyManager((label, meta) => this.log(label, meta));
  }

  async runTurn({
    turnId,
    fullText,
    chunkChars = 180,
    firstChunkChars = 90,
    singleChunk = false,
    language,
    ttsHeadStart = null,
  } = {}) {
    const state = this.turnState.init(turnId);
    this.latency.mark(state, "llmStartedAt");
    const token = this.playbackQueue.nextToken();
    const normalized = String(fullText || "").replace(/\s+/g, " ").trim();
    const chunks = singleChunk
      ? (normalized ? [normalized] : [])
      : splitSemanticChunksWithFastStart(fullText, firstChunkChars, chunkChars);
    if (!chunks.length) {
      this.turnState.close(turnId);
      return;
    }

    this.latency.mark(state, "llmFirstTokenAt");

    const useStreaming = Boolean(this.openStream && this.playStream);

    if (useStreaming) {
      let nextStreamPromise =
        ttsHeadStart || this.openStream(chunks[0], language);

      for (let i = 0; i < chunks.length; i += 1) {
        if (!this.playbackQueue.isActiveToken(token)) break;
        if (!this.isTurnActive(turnId)) break;

        const chunk = chunks[i];
        let byteStream = null;
        try {
          byteStream = await nextStreamPromise;
        } catch (error) {
          this.log("tts_stream_failed", { turnId, chunk, error: error?.message || error });
        }

        if (i + 1 < chunks.length) {
          nextStreamPromise = this.openStream(chunks[i + 1], language);
        }

        if (!byteStream) {
          if (this.synthesize) {
            const audio = await this.synthesize(chunk, language);
            if (audio) {
              if (!state.ttsFirstChunkAt) this.latency.mark(state, "ttsFirstChunkAt");
              await this.play(audio, { turnId, token });
            }
          }
          continue;
        }
        if (!state.ttsStarted) state.ttsStarted = true;

        this.onChunkStart({ turnId, chunk, index: i, total: chunks.length });
        if (!this.playbackQueue.isActiveToken(token)) break;
        if (!this.isTurnActive(turnId)) break;

        await this.playStream({
          stream: byteStream,
          turnId,
          token,
          chunk,
          index: i,
          total: chunks.length,
          onFirstFrame: () => {
            if (!state.ttsFirstChunkAt) {
              this.latency.mark(state, "ttsFirstChunkAt");
            }
            if (!state.playbackStartedAt) {
              this.latency.mark(state, "playbackStartedAt");
            }
          },
        });

        this.onChunkDone({ turnId, chunk, index: i, total: chunks.length });
      }
    } else {
      let prefetch = this.synthesize(chunks[0], language);
      for (let i = 0; i < chunks.length; i += 1) {
        if (!this.playbackQueue.isActiveToken(token)) break;
        if (!this.isTurnActive(turnId)) break;

        const chunk = chunks[i];
        const audio = await prefetch;
        if (i + 1 < chunks.length) {
          prefetch = this.synthesize(chunks[i + 1], language);
        }

        if (!audio) continue;
        if (!state.ttsStarted) state.ttsStarted = true;
        if (!state.ttsFirstChunkAt) this.latency.mark(state, "ttsFirstChunkAt");
        this.onChunkStart({ turnId, chunk, index: i, total: chunks.length });
        if (!this.playbackQueue.isActiveToken(token)) break;
        if (!this.isTurnActive(turnId)) break;
        if (!state.playbackStartedAt) this.latency.mark(state, "playbackStartedAt");
        await this.play(audio, { turnId, token });
        this.onChunkDone({ turnId, chunk, index: i, total: chunks.length });
      }
    }

    this.latency.emit(state);
    this.turnState.close(turnId);
  }

  cancelActive() {
    this.playbackQueue.invalidate();
  }
}
