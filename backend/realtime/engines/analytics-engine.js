import { getAnalyticsQueue } from "../queues/queue-manager.js";

export class AnalyticsEngine {
  async track(event, payload = {}) {
    const analyticsQueue = await getAnalyticsQueue();
    await analyticsQueue.add(
      "track",
      { event, ...payload },
      { attempts: 3, backoff: { type: "exponential", delay: 300 } },
    );
  }
}

export const analyticsEngine = new AnalyticsEngine();
