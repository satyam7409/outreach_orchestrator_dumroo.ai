import { emailQueue } from "../emailqueue.js";
async function clearQueue() {
  await emailQueue.pause();

  await emailQueue.drain(true);

  await emailQueue.clean(0, 0, "completed");
  await emailQueue.clean(0, 0, "failed");

  await emailQueue.obliterate({ force: true });

  console.log("Email queue cleared successfully");

  await emailQueue.close();
  process.exit(0);
}

clearQueue().catch(async (error) => {
  console.error("Queue cleanup failed:", error);
  await emailQueue.close();
  process.exit(1);
});