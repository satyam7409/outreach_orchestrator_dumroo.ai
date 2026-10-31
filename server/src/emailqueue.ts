import { Queue } from "bullmq";
import { redis } from "./config/redis.js";

export const emailQueue = new Queue("send-email", {
  connection: redis,

  defaultJobOptions: {
    attempts: 5,

    backoff: {
      type: "exponential",
      delay: 15000,
      jitter: 0.5,
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