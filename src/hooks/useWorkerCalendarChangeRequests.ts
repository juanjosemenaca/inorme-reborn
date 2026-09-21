import { useQuery } from "@tanstack/react-query";
import {
  fetchAllWorkerCalendarChangeRequests,
  fetchPendingWorkerCalendarChangeRequests,
  fetchWorkerCalendarChangeRequestsForWorker,
  hasPendingWorkerCalendarRequest,
} from "@/api/workerCalendarChangeRequestsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function usePendingWorkerCalendarChangeRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerCalendarChangeRequests,
    queryFn: fetchPendingWorkerCalendarChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useAllWorkerCalendarChangeRequests(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.workerCalendarChangeRequests, "all"] as const,
    queryFn: fetchAllWorkerCalendarChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useWorkerCalendarChangeHistory(companyWorkerId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerCalendarChangeRequestsFor(companyWorkerId ?? ""),
    queryFn: () => fetchWorkerCalendarChangeRequestsForWorker(companyWorkerId!),
    enabled: enabled && !!companyWorkerId,
  });
}

export function useHasPendingWorkerCalendarRequest(companyWorkerId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.workerCalendarChangeRequests, "hasPending", companyWorkerId ?? ""] as const,
    queryFn: () => hasPendingWorkerCalendarRequest(companyWorkerId!),
    enabled: !!companyWorkerId,
  });
}
