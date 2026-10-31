import { Worker } from "bullmq";
import { redis } from "../config/redis.js";

import { processEmail, type EmailJobData } from "./emailProcessor.js";

const emailWorker = new Worker<EmailJobData>(
  "send-email",
  processEmail,
  {
    connection: redis.duplicate(),

    // Keep the existing conservative Groq request rate while measuring
    // actual token usage for the new model configuration.
    concurrency: 1,

    limiter: {
      max: 4,
      duration: 60_000,
    },

    settings: {
      backoffStrategy: (attemptsMade, type, error) => {
        if (type !== "custom") {
          return -1;
        }

        const retryAfterMs =
          error &&
          typeof error === "object" &&
          "retryAfterMs" in error &&
          typeof error.retryAfterMs === "number"
            ? error.retryAfterMs
            : undefined;

        if (retryAfterMs !== undefined) {
          return Math.max(1000, retryAfterMs);
        }

        const baseDelay = 15_000;
        const exponentialDelay = Math.min(
          baseDelay * 2 ** Math.max(0, attemptsMade - 1),
          5 * 60_000,
        );

        // Add 0-25% jitter to avoid retrying all jobs at the same instant.
        return Math.round(
          exponentialDelay * (1 + Math.random() * 0.25),
        );
      },
    },
  },
);

emailWorker.on("ready", () => {
  console.log("Email worker connected to Redis and listening for jobs.");
});

emailWorker.on("active", (job) => {
  console.log(`Job ${job.id} started`);
});

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed: ${error.message}`);
});

emailWorker.on("error", (error) => {
  console.error("Email worker error:", error);
});
