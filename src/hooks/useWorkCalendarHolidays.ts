import { useQuery } from "@tanstack/react-query";
import { fetchWorkCalendarHolidays } from "@/api/workCalendarsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useWorkCalendarHolidays(year: number) {
  return useQuery({
    queryKey: queryKeys.workCalendarHolidays(year),
    queryFn: () => fetchWorkCalendarHolidays(year),
    enabled: isSupabaseConfigured() && year >= 2000 && year <= 2100,
  });
}
