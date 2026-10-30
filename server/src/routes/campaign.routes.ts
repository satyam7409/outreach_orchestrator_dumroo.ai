import { Router } from "express";
import { z } from "zod";
import { startCampaign } from "../services/campaign.js";

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
    throw new Error("Campaign Already running or no leads left")
  }
});