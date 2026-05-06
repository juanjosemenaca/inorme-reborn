import { useQuery } from "@tanstack/react-query";
import { listMyDmsDocumentReviewsAsAssignee } from "@/api/dmsDocumentsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useMyDmsDocumentReviewsAsAssignee(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myDmsDocumentReviews,
    queryFn: listMyDmsDocumentReviewsAsAssignee,
    enabled: isSupabaseConfigured() && enabled,
  });
}
