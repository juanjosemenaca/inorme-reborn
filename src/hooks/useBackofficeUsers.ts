import { useQuery } from "@tanstack/react-query";
import { fetchBackofficeUsers } from "@/api/backofficeUsersApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useBackofficeUsers() {
  return useQuery({
    queryKey: queryKeys.backofficeUsers,
    queryFn: fetchBackofficeUsers,
    enabled: isSupabaseConfigured(),
  });
}
