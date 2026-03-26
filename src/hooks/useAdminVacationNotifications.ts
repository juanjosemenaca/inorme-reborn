import { useQuery } from "@tanstack/react-query";
import {
  countVacationNotificationsSinceDays,
  fetchAdminVacationDayNotificationsEnriched,
} from "@/api/vacationNotificationsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useAdminVacationNotifications(limit = 100) {
  return useQuery({
    queryKey: queryKeys.adminVacationNotifications,
    queryFn: () => fetchAdminVacationDayNotificationsEnriched(limit),
    enabled: isSupabaseConfigured(),
  });
}

export function useVacationNotificationCount(sinceDays: number, queryEnabled = true) {
  return useQuery({
    queryKey: queryKeys.adminVacationNotificationCount(sinceDays),
    queryFn: () => countVacationNotificationsSinceDays(sinceDays),
    enabled: isSupabaseConfigured() && sinceDays > 0 && queryEnabled,
    staleTime: 60_000,
  });
}
