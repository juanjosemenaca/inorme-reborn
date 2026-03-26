import { useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { OrgChartFlow } from "@/components/admin/orgchart/OrgChartFlow";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { companyWorkersToOrgEmployees } from "@/lib/orgChartFromWorkers";
import type { OrgChartEmployee } from "@/types/orgChart";

const AdminOrgChart = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: workers = [], isLoading, isError, error } = useCompanyWorkers();
  const [direction, setDirection] = useState<"TB" | "LR">("TB");

  const employees = useMemo(() => companyWorkersToOrgEmployees(workers), [workers]);

  const onEmployeeClick = (emp: OrgChartEmployee) => {
    toast({
      title: t("admin.orgChart.click_toast_title"),
      description: [emp.name, emp.roles.join(" · "), emp.teams.length ? emp.teams.join(", ") : ""]
        .filter(Boolean)
        .join("\n"),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.orgChart.title")}</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">{t("admin.orgChart.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 text-foreground">
            <span>
              <span className="inline-block w-6 border-t-2 border-foreground align-middle mr-1.5" />{" "}
              {t("admin.orgChart.legend_hierarchy")}
            </span>
            <span>
              <span
                className="inline-block w-6 border-t-2 border-dashed border-indigo-500 align-middle mr-1.5"
                style={{ borderColor: "#6366f1" }}
              />{" "}
              {t("admin.orgChart.legend_teams")}
            </span>
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("admin.common.loading")}
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive py-8">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error instanceof Error ? error.message : t("admin.orgChart.load_error")}</span>
            </div>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{t("admin.orgChart.empty")}</p>
          ) : (
            <div className="h-[min(72vh,820px)] min-h-[420px] rounded-lg border bg-background overflow-hidden">
              <OrgChartFlow
                employees={employees}
                direction={direction}
                onDirectionChange={setDirection}
                onEmployeeClick={onEmployeeClick}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminOrgChart;
