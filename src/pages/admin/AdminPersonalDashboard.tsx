import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardMutations, useDashboardWidgets } from "@/hooks/useDashboard";
import { canOpenDashboardBuilder } from "@/lib/dashboard/widgetConfig";
import { dashboardTemplates } from "@/lib/dashboard/templates";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { DashboardAiPanel } from "@/components/dashboard/DashboardAiPanel";

const AdminPersonalDashboard = () => {
  const { t } = useLanguage();
  const { role, user } = useAdminAuth();
  const widgetsQ = useDashboardWidgets();
  const mut = useDashboardMutations();
  const [aiOpen, setAiOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const widgets = widgetsQ.data ?? [];
  const templates = useMemo(() => dashboardTemplates(role ?? "WORKER", user?.enabledModules ?? []), [role, user?.enabledModules]);
  const showAi = canOpenDashboardBuilder(role, user?.enabledModules);

  const applyTemplate = async (id: string) => {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    await mut.snapshot.mutateAsync(widgets);
    setCanUndo(true);
    for (const w of tpl.widgets) await mut.create.mutateAsync(w);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.dashboard.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {showAi ? (
            <Button type="button" className="gap-1.5" onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4" />
              {t("admin.dashboard.customize_ai")}
            </Button>
          ) : null}
        </div>
      </div>

      {widgetsQ.isLoading ? <p className="text-sm text-muted-foreground">{t("admin.common.loading")}</p> : null}
      {widgetsQ.isError ? <p className="text-sm text-destructive">{t("admin.dashboard.load_error")}</p> : null}

      {widgetsQ.isLoading || widgetsQ.isError ? null : widgets.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">{t("admin.dashboard.empty_title")}</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{t("admin.dashboard.empty_body")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {showAi ? (
              <Button type="button" onClick={() => setAiOpen(true)}>
                {t("admin.dashboard.tpl_ai")}
              </Button>
            ) : null}
            {templates.map((tpl) => (
              <Button key={tpl.id} type="button" variant="outline" onClick={() => void applyTemplate(tpl.id)}>
                {t(tpl.labelKey)}
              </Button>
            ))}
            <Button type="button" variant="ghost">
              {t("admin.dashboard.tpl_empty")}
            </Button>
          </div>
        </div>
      ) : (
        <DashboardGrid
          widgets={widgets}
          onDelete={(id) => mut.remove.mutate(id)}
          onMoveUp={(id) => {
            const w = widgets.find((x) => x.id === id);
            if (!w) return;
            mut.update.mutate({ id, patch: { position: { x: w.position.x, y: Math.max(0, w.position.y - 1) } } });
          }}
          onWiden={(id) => {
            const w = widgets.find((x) => x.id === id);
            if (!w) return;
            mut.update.mutate({ id, patch: { width: Math.min(12, w.width + 2) } });
          }}
          onSwap={(a, b) => {
            const wa = widgets.find((x) => x.id === a);
            const wb = widgets.find((x) => x.id === b);
            if (!wa || !wb) return;
            mut.update.mutate({ id: a, patch: { position: wb.position } });
            mut.update.mutate({ id: b, patch: { position: wa.position } });
          }}
        />
      )}

      <DashboardAiPanel
        open={aiOpen}
        onOpenChange={setAiOpen}
        canUndo={canUndo}
        onUndo={() => {
          mut.undo.mutate(undefined, { onSuccess: () => setCanUndo(false) });
        }}
        beforeSend={async () => {
          await mut.snapshot.mutateAsync(widgets);
          setCanUndo(true);
        }}
      />
    </div>
  );
};

export default AdminPersonalDashboard;
