import { useQuery } from "@tanstack/react-query";
import { fetchCompanyWorkers } from "@/api/companyWorkersApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useCompanyWorkers() {
  return useQuery({
    queryKey: queryKeys.companyWorkers,
    queryFn: fetchCompanyWorkers,
    enabled: isSupabaseConfigured(),
  });
}
