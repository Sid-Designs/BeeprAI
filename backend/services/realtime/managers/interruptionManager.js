export class InterruptionManager {
  constructor({ onInterrupt } = {}) {
    this.onInterrupt = onInterrupt || (async () => {});
    this.lastInterruptAt = 0;
  }

  async trigger(reason = "barge_in") {
    this.lastInterruptAt = Date.now();
    await this.onInterrupt(reason);
  }
}

