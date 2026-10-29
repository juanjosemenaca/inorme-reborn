import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import { defaultSize } from "@/lib/dashboard/catalog";
import { resolveDashboardActor } from "@/lib/dashboard/actor";
import { validateWidgetConfig, validateWidgetLayout } from "@/lib/dashboard/widgetConfig";
import { parseUndoSnapshot, snapshotFromWidgets } from "@/lib/dashboard/undo";
import type { DashboardWidget, DashboardWidgetInput, DashboardWidgetRow } from "@/types/dashboard";
import type { UserRole, WorkerModuleKey } from "@/types/backoffice";

function throwErr(e: unknown): never {
  throw new Error(getErrorMessage(e));
}

function mapRow(r: DashboardWidgetRow): DashboardWidget {
  const pos = r.position && typeof r.position === "object" ? r.position : { x: 0, y: 0 };
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    config: r.config ?? { source: "billing" },
    position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
    width: r.width,
    height: r.height,
    enabled: r.enabled,
    reportContent: r.report_content ?? null,
    reportStatus: r.report_status === "ready" || r.report_status === "error" ? r.report_status : "idle",
    reportGeneratedAt: r.report_generated_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function requireBackofficeUserId(): Promise<{ id: string; role: UserRole; modules: WorkerModuleKey[] }> {
  const actor = await resolveDashboardActor();
  return { id: actor.userId, role: actor.role, modules: actor.modules };
}

export async function fetchDashboardWidgets(): Promise<DashboardWidget[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dashboard_widgets")
    .select("*")
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  if (error) throwErr(error);
  return ((data ?? []) as DashboardWidgetRow[]).map(mapRow);
}

export async function createDashboardWidget(input: DashboardWidgetInput): Promise<DashboardWidget> {
  const profile = await requireBackofficeUserId();
  const issue = validateWidgetConfig(input.type, input.config, profile.role, profile.modules);
  if (issue) throw new Error(issue.message);
  const layoutIssue = validateWidgetLayout({
    title: input.title.trim() || "Widget",
    position: input.position,
    width: input.width,
    height: input.height,
  });
  if (layoutIssue) throw new Error(layoutIssue.message);
  const size = defaultSize(input.type);
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dashboard_widgets")
    .insert({
      user_id: profile.id,
      type: input.type,
      title: input.title.trim() || "Widget",
      config: input.config,
      position: input.position ?? { x: 0, y: 99 },
      width: input.width ?? size.width,
      height: input.height ?? size.height,
      enabled: input.enabled ?? true,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return mapRow(data as DashboardWidgetRow);
}

export async function updateDashboardWidget(
  id: string,
  patch: Partial<Pick<DashboardWidgetInput, "title" | "config" | "position" | "width" | "height" | "enabled" | "type">>
): Promise<DashboardWidget> {
  const profile = await requireBackofficeUserId();
  const sb = requireSupabase();
  if (patch.config || patch.type) {
    const { data: current, error: curErr } = await sb.from("dashboard_widgets").select("type, config").eq("id", id).maybeSingle();
    if (curErr) throwErr(curErr);
    const nextType = patch.type ?? (current?.type as DashboardWidget["type"]);
    const nextConfig = patch.config ?? (current?.config as DashboardWidget["config"]);
    if (nextType && nextConfig) {
      const issue = validateWidgetConfig(nextType, nextConfig, profile.role, profile.modules);
      if (issue) throw new Error(issue.message);
    }
  }
  const layoutIssue = validateWidgetLayout({
    title: patch.title,
    position: patch.position,
    width: patch.width,
    height: patch.height,
  });
  if (layoutIssue) throw new Error(layoutIssue.message);
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.config !== undefined) row.config = patch.config;
  if (patch.position !== undefined) row.position = patch.position;
  if (patch.width !== undefined) row.width = patch.width;
  if (patch.height !== undefined) row.height = patch.height;
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.type !== undefined) row.type = patch.type;
  const { data, error } = await sb.from("dashboard_widgets").update(row).eq("id", id).select("*").single();
  if (error) throwErr(error);
  return mapRow(data as DashboardWidgetRow);
}

export async function deleteDashboardWidget(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("dashboard_widgets").delete().eq("id", id);
  if (error) throwErr(error);
}

export async function clearDashboardWidgets(): Promise<void> {
  const profile = await requireBackofficeUserId();
  const sb = requireSupabase();
  const { error } = await sb.from("dashboard_widgets").delete().eq("user_id", profile.id);
  if (error) throwErr(error);
}

export async function saveDashboardUndoSnapshot(widgets: DashboardWidget[]): Promise<void> {
  const profile = await requireBackofficeUserId();
  const snapshot = snapshotFromWidgets(widgets);
  const sb = requireSupabase();
  const { error } = await sb.from("dashboard_preferences").upsert({
    user_id: profile.id,
    undo_snapshot: snapshot,
    updated_at: new Date().toISOString(),
  });
  if (error) throwErr(error);
}

export async function restoreDashboardUndo(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("restore_own_dashboard_undo");
  if (!error) return typeof data === "number" ? data : 0;
  const profile = await requireBackofficeUserId();
  const { data: pref, error: prefErr } = await sb.from("dashboard_preferences").select("undo_snapshot").eq("user_id", profile.id).maybeSingle();
  if (prefErr) throwErr(prefErr);
  const snap = parseUndoSnapshot(pref?.undo_snapshot);
  if (!snap?.length) return 0;
  await clearDashboardWidgets();
  for (const w of snap) {
    await createDashboardWidget(w);
  }
  return snap.length;
}

export async function saveDashboardReport(widgetId: string, content: string, status: "ready" | "error"): Promise<DashboardWidget> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dashboard_widgets")
    .update({
      report_content: content.slice(0, 20000),
      report_status: status,
      report_generated_at: new Date().toISOString(),
    })
    .eq("id", widgetId)
    .select("*")
    .single();
  if (error) throwErr(error);
  return mapRow(data as DashboardWidgetRow);
}

export async function applyDashboardLayoutRpc(replace = false): Promise<{ ok: boolean; created: string[] }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("apply_own_dashboard_layout", { p_replace: replace });
  if (error) throwErr(error);
  const row = data as { ok?: boolean; created?: string[] } | null;
  return { ok: row?.ok === true, created: Array.isArray(row?.created) ? row.created : [] };
}
