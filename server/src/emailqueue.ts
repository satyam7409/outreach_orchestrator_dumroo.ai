import { Queue } from "bullmq";
import { redis } from "./config/redis.js";

export const emailQueue = new Queue("send-email", {
  connection: redis,

  defaultJobOptions: {
    attempts: 5,

    // The worker's custom strategy respects Groq's retry-after value
    // for 429 responses and uses exponential backoff for other transient errors.
    backoff: {
      type: "custom",
    },

    removeOnComplete: {
      age: 3600,
      count: 1000,
    },

    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});
