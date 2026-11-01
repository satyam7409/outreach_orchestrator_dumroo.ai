import { useState } from "react";
import { startCampaign } from "../services/campaignService";
import type { Notice } from "../types";
export function useCampaigns(onStarted?: () => void) {
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  async function begin(limit: number) {
    setStarting(true); setNotice(null);
    try { const result = await startCampaign(limit); onStarted?.(); setNotice({ type: "success", text: `Campaign ${result.campaignId} accepted with ${result.total} lead${result.total === 1 ? "" : "s"}. Processing continues in the background.` }); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to reach the campaign service." }); }
    finally { setStarting(false); }
  }
  return { begin, starting, notice };
}
