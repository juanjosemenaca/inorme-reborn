import { useQuery } from "@tanstack/react-query";
import { fetchWorkerAgendaItems } from "@/api/workerAgendaApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useWorkerAgendaItems(
  companyWorkerId: string | null,
  fromIsoDate: string,
  toIsoDate: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.workerAgendaItems(companyWorkerId ?? "none", fromIsoDate, toIsoDate),
    queryFn: () => fetchWorkerAgendaItems(companyWorkerId as string, fromIsoDate, toIsoDate),
    enabled: isSupabaseConfigured() && enabled && !!companyWorkerId,
  });
}
