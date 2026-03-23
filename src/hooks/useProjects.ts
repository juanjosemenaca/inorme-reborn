import { useQuery } from "@tanstack/react-query";
import { fetchProjectsWithDocuments } from "@/api/projectsApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjectsWithDocuments,
    enabled: isSupabaseConfigured(),
  });
}
