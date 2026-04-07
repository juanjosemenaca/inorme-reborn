import { useQuery } from "@tanstack/react-query";
import {
  fetchAllWorkerVacationChangeRequests,
  fetchPendingWorkerVacationChangeRequests,
  fetchWorkerVacationChangeRequestsForWorker,
  hasPendingWorkerVacationRequest,
} from "@/api/workerVacationChangeRequestsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function usePendingWorkerVacationChangeRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerVacationChangeRequests,
    queryFn: fetchPendingWorkerVacationChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useAllWorkerVacationChangeRequests(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.workerVacationChangeRequests, "all"] as const,
    queryFn: fetchAllWorkerVacationChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useWorkerVacationChangeHistory(companyWorkerId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerVacationChangeRequestsFor(companyWorkerId ?? ""),
    queryFn: () => fetchWorkerVacationChangeRequestsForWorker(companyWorkerId!),
    enabled: isSupabaseConfigured() && enabled && !!companyWorkerId,
  });
}

export function useHasPendingWorkerVacationRequest(
  companyWorkerId: string | null,
  calendarYear: number,
  enabled = true
) {
  return useQuery({
    queryKey: [
      ...queryKeys.workerVacationChangeRequests,
      "hasPending",
      companyWorkerId ?? "",
      calendarYear,
    ] as const,
    queryFn: () => hasPendingWorkerVacationRequest(companyWorkerId!, calendarYear),
    enabled: isSupabaseConfigured() && enabled && !!companyWorkerId,
  });
}
