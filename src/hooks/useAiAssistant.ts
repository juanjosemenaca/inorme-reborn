import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAiConversation,
  fetchAiConversations,
  fetchAiMessages,
  sendAiMessage,
} from "@/api/aiAssistantApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useAiConversations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiConversations,
    queryFn: fetchAiConversations,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useAiMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.aiMessages(conversationId ?? ""),
    queryFn: () => fetchAiMessages(conversationId as string),
    enabled: isSupabaseConfigured() && !!conversationId,
  });
}

export function useSendAiMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendAiMessage,
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiMessages(res.conversationId) });
    },
  });
}

export function useDeleteAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAiConversation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConversations });
    },
  });
}
