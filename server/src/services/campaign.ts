
import { prisma } from "../config/db.js";
import { emailQueue } from "../emailqueue.js";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }

  return a;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
}

export async function startCampaign(limit: number) {
  const running = await prisma.campaign.findFirst({
    where: { status: "RUNNING" },
  });

  if (running) {
    throw new Error("A campaign is already running");
  }

  const pending = await prisma.lead.findMany({
    where: {
      status: "PENDING",
      campaignId: null,
    },
    select: { id: true },
  });

  const ids = shuffle(pending)
    .slice(0, limit)
    .map((lead) => lead.id);

  if (ids.length === 0) {
    throw new Error("No pending leads left");
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: { totalLeads: ids.length },
    });

    await tx.lead.updateMany({
      where: { id: { in: ids } },
      data: { campaignId: created.id },
    });

    return created;
  });

  try {
    const batches = chunk(ids, 5);

    await emailQueue.addBulk(
      batches.map((leadIds, index) => ({
        name: "send-email",
        data: {
          leadIds,
          campaignId: campaign.id,
        },
        opts: {
          jobId: `${campaign.id}-batch-${index + 1}`,
        },
      })),
    );
  } catch (error) {
    await prisma.lead.updateMany({
      where: { campaignId: campaign.id },
      data: { campaignId: null },
    });

    await prisma.campaign.delete({
      where: { id: campaign.id },
    });

    throw error;
  }

  return {
    campaignId: campaign.id,
    total: ids.length,
    batches: Math.ceil(ids.length / 5),
  };
}

export async function getCampaignStats() {
  const [totalLeads, pendingLeads, processingLeads, sentLeads, failedLeads, campaigns] =
    await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "PENDING" } }),
      prisma.lead.count({ where: { status: "PROCESSING" } }),
      prisma.lead.count({ where: { status: "SENT" } }),
      prisma.lead.count({ where: { status: "FAILED" } }),
      prisma.campaign.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    ]);

  return {
    leads: { total: totalLeads, pending: pendingLeads, processing: processingLeads, sent: sentLeads, failed: failedLeads },
    campaigns,
  };
}

export async function getCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  const [pending, processing, sent, failed] = await Promise.all([
    prisma.lead.count({ where: { campaignId, status: "PENDING" } }),
    prisma.lead.count({ where: { campaignId, status: "PROCESSING" } }),
    prisma.lead.count({ where: { campaignId, status: "SENT" } }),
    prisma.lead.count({ where: { campaignId, status: "FAILED" } }),
  ]);
  return { ...campaign, counts: { pending, processing, sent, failed }, progress: campaign.totalLeads === 0 ? 0 : Math.round(((sent + failed) / campaign.totalLeads) * 100) };
}
