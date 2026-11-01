import type { CampaignDetails } from "../../types";

export function CampaignStatus({ campaign }: { campaign: CampaignDetails | null }) {
  const progress = campaign?.progress ?? 0;
  const remaining = campaign ? campaign.counts.pending + campaign.counts.processing : 0;

  return (
    <div className="progress-row">
      <div>
        <span>Campaign progress</span>
        <strong>{campaign ? `${progress}% · ${campaign.status}` : "No active campaign"}</strong>
      </div>
      <div className="progress-track" aria-label={`${progress}% campaign progress`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>
        {campaign
          ? `Campaign ${campaign.id}: ${campaign.counts.sent} sent, ${campaign.counts.failed} failed, ${remaining} remaining.`
          : "Start a campaign to see live progress."}
      </small>
    </div>
  );
}
