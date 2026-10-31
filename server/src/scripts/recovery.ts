import { Queue } from "bullmq";
import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";

const campaignId = "cmvvoap7s0000lkvsrxtdyk3q";

async function main() {
  const failedLeads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: "FAILED",
    },
    select: {
      id: true,
      errorMessage: true,
    },
  });

  console.log("Failed leads found:", failedLeads.length);

  // Safety check: recover only the leads affected by the old model.
  if (failedLeads.length !== 25) {
    throw new Error(
      `Expected 25 failed leads, found ${failedLeads.length}. Aborting.`
    );
  }

  const allFromOldModel = failedLeads.every((lead) =>
    lead.errorMessage?.includes("llama-3.3-70b-versatile")
  );

  if (!allFromOldModel) {
    throw new Error("Some leads have different errors. Aborting.");
  }

  const connection = redis.duplicate();

  const queue = new Queue("send-email", {
    connection,
  });

  try {
    // Find old failed BullMQ jobs belonging to this campaign.
    const failedJobs = await queue.getFailed(0, -1);

    const campaignJobs = failedJobs.filter(
      (job) => job.data.campaignId === campaignId
    );

    console.log("Old failed queue jobs found:", campaignJobs.length);

    // Remove only jobs belonging to this campaign.
    for (const job of campaignJobs) {
      await job.remove();
    }

    console.log("Old failed jobs removed.");

    // Reset only the 25 affected leads.
    const result = await prisma.lead.updateMany({
      where: {
        campaignId,
        status: "FAILED",
      },
      data: {
        status: "PENDING",
        campaignId: null,
        attempts: 0,
        errorMessage: null,
        emailSubject: null,
        emailBody: null,
        processedAt: null,
      },
    });

    console.log("Leads recovered:", result.count);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

main()
  .catch((error) => {
    console.error("Recovery failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });