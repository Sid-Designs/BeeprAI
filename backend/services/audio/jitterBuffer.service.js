import { concatInt16 } from "./pcm.util.js";

export class JitterBuffer {
  constructor({ frameSamples = 480, maxFrames = 300 } = {}) {
    this.frameSamples = frameSamples;
    this.maxFrames = maxFrames;
    this.queue = [];
  }

  push(frame) {
    if (!frame?.length) return;
    this.queue.push(frame);
    if (this.queue.length > this.maxFrames) this.queue.shift();
  }

  drainAtLeast(minSamples = this.frameSamples) {
    let total = 0;
    const chunks = [];

    while (this.queue.length && total < minSamples) {
      const next = this.queue.shift();
      chunks.push(next);
      total += next.length;
    }

    return concatInt16(chunks);
  }

  sizeSamples() {
    return this.queue.reduce((sum, item) => sum + (item?.length || 0), 0);
  }

  clear() {
    this.queue.length = 0;
  }
}

