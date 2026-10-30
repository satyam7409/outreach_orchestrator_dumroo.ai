import {prisma} from "../config/db.js"
import { emailQueue } from "../emailqueue.js";


function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export async function startCampaign(limit: number) {
  // 1. only one campaign at a time
  const running = await prisma.campaign.findFirst({ where: { status: "RUNNING" } });
  if (running) throw new Error("A campaign is already running");

  // 2. pick PENDING leads that are not in a campaign yet (random mix of roles)
  const pending = await prisma.lead.findMany({
    where: { status: "PENDING", campaignId: null },
    select: { id: true },
  });
  const ids = shuffle(pending).slice(0, limit).map((l) => l.id);
  if (ids.length === 0) throw new Error("No pending leads left");

  // 3. create the campaign and attach the leads, in one transaction
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({ data: { totalLeads: ids.length } });
    await tx.lead.updateMany({ where: { id: { in: ids } }, data: { campaignId: created.id } });
    return created;
  });

  // 4. one job per lead; jobId = leadId so a lead can never be queued twice
  try {
    await emailQueue.addBulk(
      ids.map((leadId) => ({
        name: "send-email",
        data: { leadId, campaignId: campaign.id },
        opts: { jobId: leadId },
      })),
    );
  } catch (err) {
    // Redis is down: undo, so the leads are not stuck in a campaign with no jobs
    await prisma.lead.updateMany({ where: { campaignId: campaign.id }, data: { campaignId: null } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    throw err;
  }

  return { campaignId: campaign.id, total: ids.length };
}