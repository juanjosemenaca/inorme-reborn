import { useQuery } from "@tanstack/react-query";
import { fetchMyVacationDatesForYear } from "@/api/workerVacationDaysApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useWorkerVacationDays(companyWorkerId: string | null, year: number) {
  return useQuery({
    queryKey: queryKeys.workerVacationDays(companyWorkerId ?? "", year),
    queryFn: () => fetchMyVacationDatesForYear(year),
    enabled:
      isSupabaseConfigured() && !!companyWorkerId && year >= 2000 && year <= 2100,
  });
}
