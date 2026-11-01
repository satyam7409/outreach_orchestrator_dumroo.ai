import { useEffect, useState } from "react";
import { getLeadDraft } from "../../services/leadService";
import type { EmailDraft, Lead } from "../../types";

type Props = { lead: Lead; onClose: () => void };

export function EmailDraftModal({ lead, onClose }: Props) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    document.body.style.overflow = "hidden";
    void getLeadDraft(lead.id)
      .then((result) => { if (!cancelled) setDraft(result); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this email draft."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => { cancelled = true; document.body.style.overflow = ""; window.removeEventListener("keydown", handleKeyDown); };
  }, [lead.id, onClose]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Copy failed. Please check your browser clipboard permissions.");
    }
  };

  const completeEmail = draft ? `To: ${draft.recipient.name} <${draft.recipient.email}>\nSubject: ${draft.subject}\n\n${draft.body}` : "";

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-title">
        <div className="draft-header"><div><p className="eyebrow">Email preview</p><h2 id="draft-title">Generated outreach draft</h2></div><button className="modal-close" onClick={onClose} aria-label="Close email preview">×</button></div>
        {loading ? <div className="draft-state">Loading draft...</div> : error ? <div className="draft-state error-text">{error}</div> : draft ? <>
          <div className="draft-meta"><div><span>To</span><strong>{draft.recipient.name}</strong><small>{draft.recipient.email}</small></div><div><span>Context</span><strong>{draft.schoolName ?? "District outreach"}</strong><small>{draft.districtName}</small></div><span className={`lead-status ${draft.status.toLowerCase()}`}>{draft.status}</span></div>
          <div className="draft-content"><div className="draft-subject"><span>Subject</span><strong>{draft.subject}</strong></div><div className="draft-body">{draft.body}</div></div>
          <div className="draft-actions"><button onClick={() => void copy("subject", draft.subject)}>Copy subject</button><button onClick={() => void copy("body", draft.body)}>Copy email body</button><button className="primary" onClick={() => void copy("complete", completeEmail)}>Copy complete email</button></div>
          {copied && <p className="copy-feedback">{copied === "complete" ? "Complete email copied." : `${copied === "subject" ? "Subject" : "Email body"} copied.`}</p>}
        </> : null}
      </section>
    </div>
  );
}
