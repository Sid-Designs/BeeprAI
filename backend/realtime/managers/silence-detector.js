export class SilenceDetector {
  constructor() {
    this.lastSpeechAt = new Map();
  }

  markSpeech(callId) {
    this.lastSpeechAt.set(callId, Date.now());
  }

  getSilenceMs(callId) {
    const ts = this.lastSpeechAt.get(callId) || Date.now();
    return Date.now() - ts;
  }
}

export const silenceDetector = new SilenceDetector();
