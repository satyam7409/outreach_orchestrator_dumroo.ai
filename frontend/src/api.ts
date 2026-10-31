const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type StartCampaignResponse = { campaignId: string; total: number };

export async function startCampaign(limit: number): Promise<StartCampaignResponse> {
  const response = await fetch(`${API_BASE_URL}/api/campaigns/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = payload as { error?: unknown } | undefined;
    const message = typeof error?.error === "string" ? error.error : "The campaign could not be started.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || !("campaignId" in payload) || !("total" in payload)) {
    throw new Error("The server returned an invalid campaign response.");
  }
  return payload as StartCampaignResponse;
}
