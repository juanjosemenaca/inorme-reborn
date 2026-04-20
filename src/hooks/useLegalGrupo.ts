import { useQuery } from "@tanstack/react-query";
import {
  fetchLegalCalendarEvents,
  fetchLegalClients,
  fetchLegalDocuments,
  fetchLegalInvoiceById,
  fetchLegalInvoices,
  fetchLegalMatterActivities,
  fetchLegalMatterById,
  fetchLegalMatters,
  fetchLegalProcedures,
  fetchLegalTimeEntries,
} from "@/api/legalGrupoApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useLegalClients(enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalClients,
    queryFn: fetchLegalClients,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useLegalMatters(enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalMatters,
    queryFn: fetchLegalMatters,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useLegalMatter(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalMatter(id ?? "none"),
    queryFn: () => fetchLegalMatterById(id!),
    enabled: isSupabaseConfigured() && enabled && !!id,
  });
}

export function useLegalMatterActivities(matterId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalMatterActivities(matterId ?? "none"),
    queryFn: () => fetchLegalMatterActivities(matterId!),
    enabled: isSupabaseConfigured() && enabled && !!matterId,
  });
}

export function useLegalDocuments(matterId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalDocuments(matterId ?? "none"),
    queryFn: () => fetchLegalDocuments(matterId!),
    enabled: isSupabaseConfigured() && enabled && !!matterId,
  });
}

export function useLegalProcedures(matterId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalProcedures(matterId ?? "none"),
    queryFn: () => fetchLegalProcedures(matterId!),
    enabled: isSupabaseConfigured() && enabled && !!matterId,
  });
}

export function useLegalInvoices(enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalInvoices,
    queryFn: fetchLegalInvoices,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useLegalInvoice(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.legalInvoices, id ?? "none"] as const,
    queryFn: () => fetchLegalInvoiceById(id!),
    enabled: isSupabaseConfigured() && enabled && !!id,
  });
}

export function useLegalTimeEntries(
  filters: { matterId?: string } | undefined,
  enabled = true
) {
  const key = filters?.matterId ?? "all";
  return useQuery({
    queryKey: queryKeys.legalTimeEntries(key),
    queryFn: () => fetchLegalTimeEntries(filters),
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useLegalCalendarEvents(range: { fromIso: string; toIso: string; matterId?: string } | null) {
  const rangeKey = range ? `${range.fromIso}_${range.toIso}_${range.matterId ?? ""}` : "none";
  return useQuery({
    queryKey: queryKeys.legalCalendarEvents(rangeKey),
    queryFn: () => fetchLegalCalendarEvents(range!),
    enabled: isSupabaseConfigured() && !!range,
  });
}
