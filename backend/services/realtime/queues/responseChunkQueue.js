export class ResponseChunkQueue {
  constructor() {
    this.queue = [];
    this.waiters = [];
    this.closed = false;
  }

  push(item) {
    if (this.closed) return;
    if (this.waiters.length) {
      const waiter = this.waiters.shift();
      waiter(item);
      return;
    }
    this.queue.push(item);
  }

  async shift() {
    if (this.queue.length) return this.queue.shift();
    if (this.closed) return null;
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  flush() {
    this.queue = [];
  }

  close() {
    this.closed = true;
    while (this.waiters.length) {
      const waiter = this.waiters.shift();
      waiter(null);
    }
  }
}

