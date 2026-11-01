import { useCallback, useEffect, useState } from "react";
import { getCampaign, getStats } from "../services/campaignService";
import type { CampaignDetails, Stats } from "../types";

export function useDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextStats = await getStats();
      setStats(nextStats);
      setError(null);
      return nextStats;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard data.");
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const activeCampaign = stats?.campaigns.find((item) => item.status === "RUNNING");
    if (!activeCampaign) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const nextCampaign = await getCampaign(activeCampaign.id);
        if (cancelled) return;
        setCampaign(nextCampaign);
        if (nextCampaign.status === "COMPLETED") {
          await refresh();
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load campaign status.");
        }
      }
    };

    void poll();
    const timer = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh, stats?.campaigns]);

  return { stats, campaign, error, refresh };
}
