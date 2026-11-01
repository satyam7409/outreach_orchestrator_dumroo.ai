
import { Worker } from "bullmq";
import { redis } from "../config/redis.js";

import {
  processEmail,
  type EmailJobData,
} from "./emailProcessor.js";

const emailWorker = new Worker<EmailJobData>(
  "send-email",
  processEmail,
  {
    connection: redis.duplicate(),

    concurrency: 1,

    limiter: {
      max: 5,
      duration: 60_000,
    },
  },
);

emailWorker.on("ready", () => {
  console.log("Batch email worker connected to Redis.");
});

emailWorker.on("active", (job) => {
  console.log(`Batch job ${job.id} started`);
});

emailWorker.on("completed", (job) => {
  console.log(`Batch job ${job.id} completed`);
});

emailWorker.on("failed", (job, error) => {
  console.error(`Batch job ${job?.id} failed: ${error.message}`);
});

emailWorker.on("error", (error) => {
  console.error("Email worker error:", error);
});
