import { useState } from "react";
import { useLeads } from "../../hooks/useLeads";
import { leadStatuses, type LeadStatus } from "../../types";

const headings = ["Administrator", "Role", "School", "District", "Email", "Enrollment", "Status"];

export function LeadsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const { data, error, loading } = useLeads(page, search, status);

  const changeStatus = (nextStatus: LeadStatus | "ALL") => {
    setPage(1);
    setStatus(nextStatus);
  };

  return (
    <section className="leads card">
      <div className="section-heading">
        <div>
          <h2>Leads</h2>
          <p className="muted">Search and filter the database-backed lead list.</p>
        </div>
        <span className="record-count">{data ? `${data.total} records` : "Loading..."}</span>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search administrator, school, district..."
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <div className="filters">
          {["ALL", ...leadStatuses].map((filter) => (
            <button
              key={filter}
              className={status === filter ? "active" : ""}
              onClick={() => changeStatus(filter as LeadStatus | "ALL")}
            >
              {filter[0] + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={7}><div className="empty"><strong>{error}</strong></div></td></tr>
            ) : loading ? (
              <tr><td colSpan={7}><div className="empty">Loading leads...</div></td></tr>
            ) : data?.items.length ? (
              data.items.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.adminName}</td>
                  <td>{lead.role}</td>
                  <td>{lead.school?.name ?? "-"}</td>
                  <td>{lead.district.name}</td>
                  <td>{lead.adminEmail}</td>
                  <td>{lead.school?.enrollment ?? lead.district.enrollment ?? "-"}</td>
                  <td>{lead.status}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7}><div className="empty">No leads match the current filters.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="record-count">Page {page} of {data.totalPages}</span>
          <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
