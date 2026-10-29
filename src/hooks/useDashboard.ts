import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearDashboardWidgets,
  createDashboardWidget,
  deleteDashboardWidget,
  fetchDashboardWidgets,
  restoreDashboardUndo,
  saveDashboardReport,
  saveDashboardUndoSnapshot,
  updateDashboardWidget,
} from "@/api/dashboardWidgetsApi";
import { loadWidgetData } from "@/lib/dashboard/dataService";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { DashboardWidget } from "@/types/dashboard";

export function useDashboardWidgets() {
  return useQuery({
    queryKey: queryKeys.dashboardWidgets,
    queryFn: fetchDashboardWidgets,
    enabled: isSupabaseConfigured(),
    staleTime: 15_000,
  });
}

export function useWidgetData(widget: DashboardWidget, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboardWidgetData(widget.id, widget.updatedAt),
    queryFn: () => loadWidgetData(widget),
    enabled: isSupabaseConfigured() && enabled && widget.type !== "AI_REPORT",
    staleTime: 5 * 60_000,
  });
}

export function useDashboardMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.dashboardWidgets });
  return {
    create: useMutation({ mutationFn: createDashboardWidget, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateDashboardWidget>[1] }) =>
        updateDashboardWidget(id, patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteDashboardWidget, onSuccess: invalidate }),
    clear: useMutation({ mutationFn: clearDashboardWidgets, onSuccess: invalidate }),
    snapshot: useMutation({ mutationFn: saveDashboardUndoSnapshot }),
    undo: useMutation({ mutationFn: restoreDashboardUndo, onSuccess: invalidate }),
    saveReport: useMutation({
      mutationFn: ({ id, content, status }: { id: string; content: string; status: "ready" | "error" }) =>
        saveDashboardReport(id, content, status),
      onSuccess: invalidate,
    }),
  };
}
