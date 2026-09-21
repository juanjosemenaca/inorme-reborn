import { useQuery } from "@tanstack/react-query";
import {
  fetchAllWorkerModuleChangeRequests,
  fetchPendingWorkerModuleChangeRequests,
  fetchWorkerModuleChangeRequestsForWorker,
  hasPendingWorkerModuleRequest,
} from "@/api/workerModuleChangeRequestsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function usePendingWorkerModuleChangeRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerModuleChangeRequests,
    queryFn: fetchPendingWorkerModuleChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useAllWorkerModuleChangeRequests(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.workerModuleChangeRequests, "all"] as const,
    queryFn: fetchAllWorkerModuleChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useWorkerModuleChangeHistory(companyWorkerId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerModuleChangeRequestsFor(companyWorkerId ?? ""),
    queryFn: () => fetchWorkerModuleChangeRequestsForWorker(companyWorkerId!),
    enabled: enabled && !!companyWorkerId,
  });
}

export function useHasPendingWorkerModuleRequest(companyWorkerId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.workerModuleChangeRequests, "hasPending", companyWorkerId ?? ""] as const,
    queryFn: () => hasPendingWorkerModuleRequest(companyWorkerId!),
    enabled: !!companyWorkerId,
  });
}
