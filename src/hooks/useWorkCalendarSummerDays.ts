import { useQuery } from "@tanstack/react-query";
import { fetchWorkCalendarSummerDays } from "@/api/workCalendarsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useWorkCalendarSummerDays(year: number) {
  return useQuery({
    queryKey: queryKeys.workCalendarSummerDays(year),
    queryFn: () => fetchWorkCalendarSummerDays(year),
    enabled: isSupabaseConfigured() && year >= 2000 && year <= 2100,
  });
}
