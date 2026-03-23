import { useQuery } from "@tanstack/react-query";
import { fetchProviders } from "@/api/providersApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: fetchProviders,
    enabled: isSupabaseConfigured(),
  });
}
