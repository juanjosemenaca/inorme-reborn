import { useQuery } from "@tanstack/react-query";
import { fetchAdminVacationSummaries } from "@/api/adminVacationsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useAdminVacationSummaries(selectedYear: number) {
  return useQuery({
    queryKey: queryKeys.adminVacationSummaries(selectedYear),
    queryFn: () => fetchAdminVacationSummaries(selectedYear),
    enabled: isSupabaseConfigured() && selectedYear >= 2000 && selectedYear <= 2100,
  });
}
