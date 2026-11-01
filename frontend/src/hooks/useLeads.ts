import { useEffect, useState } from "react";
import { getLeads } from "../services/leadService";
import type { LeadStatus, LeadsResponse } from "../types";

export function useLeads(page: number, search: string, status: LeadStatus | "ALL") {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getLeads({ page, pageSize: 25, search, status })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load leads.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, status]);

  return { data, error, loading };
}
