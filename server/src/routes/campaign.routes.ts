import { Router } from "express";
import { z } from "zod";
import { getCampaign, getCampaignStats, startCampaign } from "../services/campaign.js";

const startBody = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export const campaignRouter = Router();

campaignRouter.post("/start", async (req, res, next) => {
  const parsed = startBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const result = await startCampaign(parsed.data.limit);
    res.status(202).json(result); // 202 = accepted, work continues in the background
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : "Campaign could not be started" });
  }
});

campaignRouter.get("/stats", async (_req, res, next) => {
  try { res.json(await getCampaignStats()); } catch (error) { next(error); }
});

campaignRouter.get("/:campaignId", async (req, res, next) => {
  try {
    const campaign = await getCampaign(req.params.campaignId);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(campaign);
  } catch (error) { next(error); }
});
