import { request } from "./api";
import type { LeadStatus, LeadsResponse } from "../types";
export function getLeads(params: { page: number; pageSize: number; search: string; status: LeadStatus | "ALL" }) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set("search", params.search);
  if (params.status !== "ALL") query.set("status", params.status);
  return request<LeadsResponse>(`/leads?${query}`);
}
