import { useQuery } from "@tanstack/react-query";
import {
  countMyUnreadBackofficeMessages,
  fetchMyBackofficeMessages,
} from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useMyBackofficeMessages(enabled = true) {
  return useQuery({
    queryKey: queryKeys.backofficeMessages,
    queryFn: () => fetchMyBackofficeMessages(200),
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useMyUnreadBackofficeMessageCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.backofficeMessageUnreadCount,
    queryFn: countMyUnreadBackofficeMessages,
    enabled: isSupabaseConfigured() && enabled,
    staleTime: 60_000,
  });
}
