import { useQuery } from "@tanstack/react-query";
import {
  fetchAllWorkerProfileChangeRequests,
  fetchPendingWorkerProfileChangeRequests,
  fetchWorkerProfileChangeRequestsForWorker,
  hasPendingWorkerProfileRequest,
} from "@/api/workerProfileChangeRequestsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function usePendingWorkerProfileChangeRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerProfileChangeRequests,
    queryFn: fetchPendingWorkerProfileChangeRequests,
    enabled,
  });
}

export function useAllWorkerProfileChangeRequests(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.workerProfileChangeRequests, "all"] as const,
    queryFn: fetchAllWorkerProfileChangeRequests,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useWorkerProfileChangeHistory(companyWorkerId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workerProfileChangeRequestsFor(companyWorkerId ?? ""),
    queryFn: () => fetchWorkerProfileChangeRequestsForWorker(companyWorkerId!),
    enabled: enabled && !!companyWorkerId,
  });
}

export function useHasPendingWorkerRequest(companyWorkerId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.workerProfileChangeRequests, "hasPending", companyWorkerId ?? ""] as const,
    queryFn: () => hasPendingWorkerProfileRequest(companyWorkerId!),
    enabled: !!companyWorkerId,
  });
}
