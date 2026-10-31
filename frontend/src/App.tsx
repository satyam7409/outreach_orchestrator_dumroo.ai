import { useState } from "react";
import { startCampaign } from "./api";

const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED"] as const;

export function App() {
  const [limit, setLimit] = useState(25);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleStart() {
    setStarting(true); setNotice(null);
    try {
      const result = await startCampaign(limit);
      setNotice({ type: "success", text: `Campaign ${result.campaignId} accepted with ${result.total} lead${result.total === 1 ? "" : "s"}. Processing continues in the background.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to reach the campaign service." });
    } finally { setStarting(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">D</span><div><strong>Dumroo</strong><span>Outreach Orchestrator</span></div></div><span className="environment"><i /> Operations console</span></header>
    <main className="content">
      <section className="intro"><div><p className="eyebrow">Campaign control</p><h1>Outreach overview</h1><p className="muted">Coordinate personalized school outreach from one focused workspace.</p></div><span className="connection"><i /> API configured</span></section>
      {notice && <div className={`notice ${notice.type}`} role="status">{notice.text}</div>}
      <section className="overview card">
        <div className="section-heading"><div><h2>Campaign overview</h2><p className="muted">Live totals will appear when the leads read API is available.</p></div><button className="primary" onClick={handleStart} disabled={starting}>{starting ? "Starting…" : "Start campaign"}<span>→</span></button></div>
        <div className="metric-grid">{statuses.map((status) => <div className="metric" key={status}><span className={`status-dot ${status.toLowerCase()}`} /><div><strong>—</strong><span>{status[0] + status.slice(1).toLowerCase()}</span></div></div>)}</div>
        <div className="progress-row"><div><span>Campaign progress</span><strong>Awaiting lead data</strong></div><div className="progress-track"><span /></div><small>Not available</small></div>
        <div className="control-row"><label htmlFor="batch">Batch size</label><input id="batch" type="number" min="1" max="500" value={limit} onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} /><span className="hint">1–500 leads per campaign · default 25</span></div>
      </section>
      <section className="leads card"><div className="section-heading"><div><h2>Leads</h2><p className="muted">Search and status filters will activate when the backend exposes lead listing endpoints.</p></div><span className="record-count">No records loaded</span></div><div className="toolbar"><input className="search" placeholder="Search administrator, school, district…" disabled /><div className="filters">{["All", ...statuses.map((s) => s[0] + s.slice(1).toLowerCase())].map((filter) => <button key={filter} disabled={filter !== "All"} className={filter === "All" ? "active" : ""}>{filter}</button>)}</div></div><div className="table-wrap"><table><thead><tr><th>Administrator</th><th>Role</th><th>School</th><th>District</th><th>Email</th><th>Enrollment</th><th>Status</th></tr></thead><tbody><tr><td colSpan={7}><div className="empty"><span className="empty-icon">⌁</span><strong>Lead data is not exposed by the API yet</strong><p>The current server exposes campaign start only. Add a paginated leads endpoint and aggregate counts to populate this table accurately.</p></div></td></tr></tbody></table></div></section>
      <p className="footer-note">Campaign start is asynchronous. A successful request means the queue accepted the batch; it does not mean all emails were sent.</p>
    </main>
  </div>;
}
