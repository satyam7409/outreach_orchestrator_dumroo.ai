
import { prisma } from "../config/db.js";

export async function claimLead(
  leadId: string,
  campaignId: string
) {
  // Atomically change PENDING -> PROCESSING.
  // Only one worker can successfully claim this lead.
  return prisma.lead.updateMany({
    where: {
      id: leadId,
      campaignId,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      attempts: {
        increment: 1,
      },
      errorMessage: null,
    },
  });
}

export async function getLeadWithContext(leadId: string) {
  return prisma.lead.findUnique({
    where: {
      id: leadId,
    },
    include: {
      district: true,
      school: true,
    },
  });
}

export async function markLeadSent(
  leadId: string,
  subject: string,
  body: string
) {
  const result = await prisma.lead.updateMany({
    where: {
      id: leadId,
      status: "PROCESSING",
    },
    data: {
      status: "SENT",
      emailSubject: subject,
      emailBody: body,
      processedAt: new Date(),
      errorMessage: null,
    },
  });

  if (result.count === 0) {
    throw new Error(`Could not mark lead ${leadId} as SENT`);
  }
}

export async function markLeadFailed(
  leadId: string,
  errorMessage: string
) {
  return prisma.lead.updateMany({
    where: {
      id: leadId,
      status: "PROCESSING",
    },
    data: {
      status: "FAILED",
      errorMessage,
      processedAt: new Date(),
    },
  });
}

export async function releaseLeadForRetry(leadId: string) {
  const result = await prisma.lead.updateMany({
    where: {
      id: leadId,
      status: "PROCESSING",
    },
    data: {
      status: "PENDING",
    },
  });

  if (result.count === 0) {
    throw new Error(
      `Could not release lead ${leadId} for retry`
    );
  }
}

export async function completeCampaignIfFinished(
  campaignId: string
) {
  const remainingLeads = await prisma.lead.count({
    where: {
      campaignId,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },
  });

  if (remainingLeads > 0) {
    return false;
  }

  await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      status: "RUNNING",
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  console.log(`Campaign ${campaignId} completed`);

  return true;
}



export async function getLeadsWithContext(leadIds: string[]) {
  return prisma.lead.findMany({
    where: {
      id: { in: leadIds },
    },
    include: {
      district: true,
      school: true,
    },
  });
}

export async function releaseLeadsForRetry(leadIds: string[]) {
  if (leadIds.length === 0) return;

  await prisma.lead.updateMany({
    where: {
      id: { in: leadIds },
      status: "PROCESSING",
    },
    data: {
      status: "PENDING",
    },
  });
}

export async function markLeadsFailed(
  leadIds: string[],
  errorMessage: string,
) {
  if (leadIds.length === 0) return;

  await prisma.lead.updateMany({
    where: {
      id: { in: leadIds },
      status: "PROCESSING",
    },
    data: {
      status: "FAILED",
      errorMessage,
      processedAt: new Date(),
    },
  });
}
