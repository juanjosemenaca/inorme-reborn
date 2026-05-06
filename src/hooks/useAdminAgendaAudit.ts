import { useQuery } from "@tanstack/react-query";
import { fetchAdminAgendaAuditItems } from "@/api/workerAgendaApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useAdminAgendaAuditItems(
  fromIsoDate: string,
  toIsoDate: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.adminAgendaAuditItems(fromIsoDate, toIsoDate),
    queryFn: () => fetchAdminAgendaAuditItems(fromIsoDate, toIsoDate),
    enabled: isSupabaseConfigured() && enabled,
  });
}
