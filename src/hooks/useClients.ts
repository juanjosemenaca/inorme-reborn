import { useQuery } from "@tanstack/react-query";
import { fetchClients } from "@/api/clientsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: fetchClients,
    enabled: isSupabaseConfigured(),
  });
}
