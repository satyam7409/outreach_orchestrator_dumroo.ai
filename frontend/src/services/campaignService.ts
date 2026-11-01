import { request } from "./api";
import type { CampaignDetails, StartCampaignResponse, Stats } from "../types";
export function startCampaign(limit: number) {
  return request<StartCampaignResponse>("/campaigns/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit }) });
}
export const getStats = () => request<Stats>("/campaigns/stats");
export const getCampaign = (id: string) => request<CampaignDetails>(`/campaigns/${id}`);
