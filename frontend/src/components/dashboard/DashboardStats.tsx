import type { Stats } from "../../types";

const metricNames = ["Total", "Pending", "Processing", "Sent", "Failed"] as const;

export function DashboardStats({ stats }: { stats: Stats | null }) {
  const values = stats
    ? [stats.leads.total, stats.leads.pending, stats.leads.processing, stats.leads.sent, stats.leads.failed]
    : [null, null, null, null, null];

  return (
    <div className="metric-grid">
      {metricNames.map((name, index) => (
        <div className="metric" key={name}>
          <span className={`status-dot ${name.toLowerCase()}`} />
          <div>
            <strong>{values[index] ?? "-"}</strong>
            <span>{name} leads</span>
          </div>
        </div>
      ))}
    </div>
  );
}
