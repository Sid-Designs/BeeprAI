const now = () => Date.now();

export class CircuitBreaker {
  constructor({
    name = "service",
    failureThreshold = 5,
    resetTimeoutMs = 15000,
    halfOpenMaxCalls = 1,
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxCalls = halfOpenMaxCalls;
    this.state = "closed";
    this.failures = 0;
    this.nextTryAt = 0;
    this.halfOpenCalls = 0;
  }

  canExecute() {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (now() >= this.nextTryAt) {
        this.state = "half_open";
        this.halfOpenCalls = 0;
      } else {
        return false;
      }
    }
    if (this.state === "half_open") {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) return false;
      this.halfOpenCalls += 1;
    }
    return true;
  }

  onSuccess() {
    this.state = "closed";
    this.failures = 0;
    this.nextTryAt = 0;
    this.halfOpenCalls = 0;
  }

  onFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.nextTryAt = now() + this.resetTimeoutMs;
    }
  }
}

export const withCircuitBreaker = async (breaker, fn) => {
  if (!breaker.canExecute()) {
    const error = new Error(`CircuitOpen:${breaker.name}`);
    error.code = "CIRCUIT_OPEN";
    throw error;
  }
  try {
    const result = await fn();
    breaker.onSuccess();
    return result;
  } catch (error) {
    breaker.onFailure();
    throw error;
  }
};

