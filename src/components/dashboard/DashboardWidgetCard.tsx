import { Loader2, MoreHorizontal, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWidgetData } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";
import type { DashboardWidget } from "@/types/dashboard";
import { AiDashboardReport } from "@/components/dashboard/AiDashboardReport";

const PIE_COLORS = ["#ea580c", "#c2410c", "#9a3412", "#78716c", "#57534e", "#a8a29e"];

type Props = {
  widget: DashboardWidget;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onWiden: (id: string) => void;
};

export function DashboardWidgetCard({ widget, onDelete, onMoveUp, onWiden }: Props) {
  const { t } = useLanguage();
  const q = useWidgetData(widget);

  return (
    <Card className="group flex h-full flex-col overflow-hidden" style={{ minHeight: widget.height * 72 }}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold leading-snug pr-2">{widget.title}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{t("admin.common.actions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => q.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("admin.dashboard.refresh")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveUp(widget.id)}>{t("admin.dashboard.move_up")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onWiden(widget.id)}>{t("admin.dashboard.make_wider")}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(widget.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("admin.common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {widget.type === "AI_REPORT" ? (
          <AiDashboardReport widget={widget} />
        ) : q.isLoading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : q.isError ? (
          <p className="text-sm text-destructive">{t("admin.dashboard.widget_error")}</p>
        ) : q.data?.kind === "kpi" ? (
          <div>
            <p className="text-2xl font-semibold tabular-nums">{q.data.formatted}</p>
            {q.data.variation ? (
              <p
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                  q.data.variation.startsWith("+") && "text-emerald-600",
                  (q.data.variation.startsWith("-") || q.data.variation.startsWith("−")) && "text-red-600"
                )}
              >
                {q.data.variation.startsWith("+") ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {q.data.variation}
              </p>
            ) : null}
          </div>
        ) : q.data?.kind === "chart" ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {widget.type === "BAR_CHART" ? (
                <BarChart data={q.data.points}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : widget.type === "PIE_CHART" ? (
                <PieChart>
                  <Pie data={q.data.points} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70}>
                    {q.data.points.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <LineChart data={q.data.points}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : q.data?.kind === "table" ? (
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {q.data.columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.rows.map((r, i) => (
                  <TableRow key={i}>
                    {r.cells.map((c, j) => (
                      <TableCell key={j} className={j > 0 ? "text-right tabular-nums" : ""}>
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : q.data?.kind === "alert" ? (
          <p className={cn("text-sm", q.data.level === "warn" ? "text-amber-700" : "text-muted-foreground")}>{q.data.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{q.data?.kind === "empty" ? q.data.message : "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}
