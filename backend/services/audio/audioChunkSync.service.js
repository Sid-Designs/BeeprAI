import { EventEmitter } from "events";
import { rms } from "./pcm.util.js";

export class AudioChunkSyncService extends EventEmitter {
  constructor({ silenceThreshold = 0.008, minSpeechMs = 220, sampleRate = 24000 } = {}) {
    super();
    this.silenceThreshold = silenceThreshold;
    this.minSpeechMs = minSpeechMs;
    this.sampleRate = sampleRate;
    this.userSpeaking = false;
    this.speechStartedAt = 0;
    this.lastAudioAt = Date.now();
  }

  ingest(samples = new Int16Array(0)) {
    const level = rms(samples);
    const now = Date.now();
    this.lastAudioAt = now;

    if (level > this.silenceThreshold) {
      if (!this.userSpeaking) {
        this.userSpeaking = true;
        this.speechStartedAt = now;
        this.emit("speech.start", { at: now, level });
      }
      return { speaking: true, level };
    }

    if (this.userSpeaking) {
      const activeMs = now - this.speechStartedAt;
      if (activeMs >= this.minSpeechMs) {
        this.emit("speech.end", { at: now, activeMs, level });
      }
      this.userSpeaking = false;
    }
    return { speaking: false, level };
  }

  silenceMs() {
    return Date.now() - this.lastAudioAt;
  }
}

