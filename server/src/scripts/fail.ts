import { prisma } from "../config/db.js";

async function main() {
  const failedLeads = await prisma.lead.findMany({
    where: {
      status: "FAILED",
    },
    select: {
      id: true,
      campaignId: true,
      adminEmail: true,
      errorMessage: true,
    },
  });

  console.log("\nFailed leads:", failedLeads.length);

  const campaigns = await prisma.lead.groupBy({
    by: ["campaignId"],
    where: {
      status: "FAILED",
    },
    _count: {
      id: true,
    },
  });

  console.log("\nFailed leads by campaign:");
  console.log(campaigns);

  console.log("\nSample failed lead:");
  console.log(failedLeads[0] ?? "No failed leads found");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });