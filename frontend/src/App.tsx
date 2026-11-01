import { useState } from "react";
import { Notice } from "./components/common/Notice";
import { CampaignControls } from "./components/dashboard/CampaignControls";
import { CampaignStatus } from "./components/dashboard/CampaignStatus";
import { DashboardStats } from "./components/dashboard/DashboardStats";
import { LeadsTable } from "./components/dashboard/LeadsTable";
import { useCampaigns } from "./hooks/useCampaigns";
import { useDashboard } from "./hooks/useDashboard";

export function App() {
  const [limit, setLimit] = useState(25);
  const { stats, campaign, error, refresh } = useDashboard();
  const { begin, starting, notice } = useCampaigns(refresh);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <div><strong>Dumroo</strong><span>Outreach Orchestrator</span></div>
        </div>
        <span className="environment"><i /> Operations console</span>
      </header>

      <main className="content">
        <section className="intro">
          <div>
            <p className="eyebrow">Campaign control</p>
            <h1>Outreach overview</h1>
            <p className="muted">Coordinate personalized school outreach from one focused workspace.</p>
          </div>
          <span className="connection"><i /> API configured</span>
        </section>

        {error && <Notice notice={{ type: "error", text: error }} />}
        <Notice notice={notice} />

        <section className="overview card">
          <div className="section-heading">
            <div>
              <h2>Campaign overview</h2>
              <p className="muted">Live totals from the campaign and lead database.</p>
            </div>
            <CampaignControls
              limit={limit}
              starting={starting}
              onLimitChange={setLimit}
              onStart={() => void begin(limit)}
            />
          </div>
          <DashboardStats stats={stats} />
          <CampaignStatus campaign={campaign} />
        </section>

        <LeadsTable />
        <p className="footer-note">Campaign start is asynchronous. A successful request means the queue accepted the batch; it does not mean all emails were sent.</p>
      </main>
    </div>
  );
}
