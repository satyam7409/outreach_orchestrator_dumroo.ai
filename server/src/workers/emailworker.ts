import { Worker } from "bullmq";
import { redis } from "../config/redis.js";

import { processEmail, type EmailJobData } from "./emailProcessor.js";

const emailWorker = new Worker<EmailJobData>("send-email", processEmail, {
  connection: redis.duplicate(),
  concurrency: 5,
});

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
