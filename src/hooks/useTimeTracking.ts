import { useQuery } from "@tanstack/react-query";
import {
  fetchMyTimeClockEvents,
  fetchWorkerTimeClockEvents,
  fetchWorkersTimeClockEventsAsAdmin,
} from "@/api/timeTrackingApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useMyTimeClockEvents(fromIsoDate: string, toIsoDate: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myTimeClockEvents(fromIsoDate, toIsoDate),
    queryFn: () => fetchMyTimeClockEvents(fromIsoDate, toIsoDate),
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useWorkerTimeClockEvents(
  workerId: string | null,
  fromIsoDate: string,
  toIsoDate: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.workerTimeClockEvents(workerId ?? "none", fromIsoDate, toIsoDate),
    queryFn: () => fetchWorkerTimeClockEvents(workerId as string, fromIsoDate, toIsoDate),
    enabled: isSupabaseConfigured() && enabled && !!workerId,
  });
}

export function useWorkersTimeClockEvents(
  workerIds: string[],
  fromIsoDate: string,
  toIsoDate: string,
  enabled = true
) {
  const sortedWorkerIds = [...workerIds].sort();
  const workerIdsKey = sortedWorkerIds.join(",");
  return useQuery({
    queryKey: queryKeys.workersTimeClockEvents(workerIdsKey || "none", fromIsoDate, toIsoDate),
    queryFn: () => fetchWorkersTimeClockEventsAsAdmin(sortedWorkerIds, fromIsoDate, toIsoDate),
    enabled: isSupabaseConfigured() && enabled && sortedWorkerIds.length > 0,
  });
}
