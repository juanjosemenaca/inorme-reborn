import { useQuery } from "@tanstack/react-query";
import {
  countMyUnreadBackofficeMessages,
  fetchMyBackofficeMessagesFiltered,
} from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useMyBackofficeMessages(enabled = true, includeArchived = false) {
  return useQuery({
    queryKey: [...queryKeys.backofficeMessages, includeArchived ? "withArchived" : "active"] as const,
    queryFn: () => fetchMyBackofficeMessagesFiltered(200, { includeArchived }),
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useMyUnreadBackofficeMessageCount(
  enabled = true,
  options?: { refetchIntervalMs?: number | false }
) {
  return useQuery({
    queryKey: queryKeys.backofficeMessageUnreadCount,
    queryFn: countMyUnreadBackofficeMessages,
    enabled: isSupabaseConfigured() && enabled,
    staleTime: 60_000,
    refetchInterval: options?.refetchIntervalMs ?? false,
    refetchOnWindowFocus: true,
  });
}
