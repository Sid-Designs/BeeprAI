let analyticsQueue;
let handoffQueue;
let workersStarted = false;
const REDIS_ENABLED = String(process.env.REDIS_ENABLED || "false").toLowerCase() === "true";

const inMemoryJobs = [];

const createInMemoryQueue = (name) => ({
  async add(jobName, data) {
    inMemoryJobs.push({ queue: name, jobName, data, ts: Date.now() });
    return { id: `${name}-${Date.now()}` };
  },
});

const initQueues = async () => {
  if (!REDIS_ENABLED) {
    analyticsQueue = createInMemoryQueue("beepr-analytics");
    handoffQueue = createInMemoryQueue("beepr-handoffs");
    return {
      startQueueWorkers: () => {
        workersStarted = true;
      },
    };
  }

  try {
    const { Queue, Worker } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    connection.on("error", () => {
      // silence noisy ioredis errors; runtime will fallback if init fails
    });

    analyticsQueue = new Queue("beepr-analytics", { connection });
    handoffQueue = new Queue("beepr-handoffs", { connection });

    const startQueueWorkers = () => {
      if (workersStarted) return;
      workersStarted = true;

      new Worker("beepr-analytics", async (job) => ({ ok: true, event: job.data?.event }), { connection });
      new Worker("beepr-handoffs", async (job) => ({ ok: true, handoffType: job.data?.handoffType }), { connection });
    };

    return { startQueueWorkers };
  } catch {
    analyticsQueue = createInMemoryQueue("beepr-analytics");
    handoffQueue = createInMemoryQueue("beepr-handoffs");

    return {
      startQueueWorkers: () => {
        workersStarted = true;
      },
    };
  }
};

const queueBoot = initQueues();

export const getAnalyticsQueue = async () => {
  await queueBoot;
  return analyticsQueue;
};

export const getHandoffQueue = async () => {
  await queueBoot;
  return handoffQueue;
};

export const startQueueWorkers = async () => {
  const runtime = await queueBoot;
  runtime.startQueueWorkers();
};
