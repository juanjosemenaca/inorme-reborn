import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard RLS contract", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261009120000_dashboard_builder.sql"), "utf8");
  const security = readFileSync(resolve(process.cwd(), "supabase/migrations/20261009154500_dashboard_builder_security.sql"), "utf8");

  it("cada usuario solo accede a sus widgets (no hay política abierta)", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("dashboard_widgets_select_own");
    expect(sql).toContain("dashboard_widgets_insert_own");
    expect(sql).toContain("dashboard_widgets_update_own");
    expect(sql).toContain("dashboard_widgets_delete_own");
    expect(sql).toContain("user_id = public.ai_current_backoffice_user_id()");
    expect(sql).not.toContain("USING (true)");
    expect(sql).toContain("REVOKE ALL ON TABLE public.dashboard_widgets FROM anon");
  });

  it("no hay SQL libre ni tipos de widget fuera del catálogo", () => {
    expect(sql).toContain("'AI_REPORT'");
    expect(sql).toContain("'LINE_CHART'");
    expect(sql).toContain("dashboard_schedules");
  });

  it("la migración de seguridad impide schedule sobre widget ajeno y fuentes desconocidas", () => {
    expect(security).toContain("dashboard_schedule_widget_owned");
    expect(security).toContain("w.user_id = NEW.user_id");
    expect(security).toContain("dashboard_unknown_source");
    expect(security).toContain("dashboard_source_forbidden");
    expect(security).toContain("dashboard_user_has_source");
    expect(security).toContain("apply_own_dashboard_layout");
    expect(security).toContain("restore_own_dashboard_undo");
    expect(security).toContain("report_content");
    expect(security).not.toContain("USING (true)");
  });
});
