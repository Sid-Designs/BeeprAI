export class PlaybackQueue {
  constructor() {
    this.currentToken = 0;
    this.active = false;
  }

  nextToken() {
    this.currentToken += 1;
    return this.currentToken;
  }

  isActiveToken(token) {
    return token === this.currentToken;
  }

  invalidate() {
    this.currentToken += 1;
    this.active = false;
  }
}

