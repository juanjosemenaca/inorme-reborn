import { useQuery } from "@tanstack/react-query";
import { fetchWorkCalendarSites } from "@/api/workCalendarSitesApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useWorkCalendarSites() {
  return useQuery({
    queryKey: queryKeys.workCalendarSites,
    queryFn: fetchWorkCalendarSites,
    enabled: isSupabaseConfigured(),
  });
}
