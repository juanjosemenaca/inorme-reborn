import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { CHART_COLORS, preparePieSlices } from "@/lib/ai/charts";
import { formatEuro, formatPercent } from "@/lib/ai/format";
import type { AiChart, AiChartUnit } from "@/types/ai";

function formatValue(value: number, unit: AiChartUnit): string {
  if (unit === "eur") return formatEuro(value);
  if (unit === "percent") return formatPercent(value, false);
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function formatAxis(value: number, unit: AiChartUnit): string {
  if (unit === "percent") return `${Math.round(value)}%`;
  if (unit !== "eur") return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1000) return `${Math.round(value / 1000).toLocaleString("es-ES")} mil`;
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
}

function clipLabel(label: string, max = 28): string {
  const t = label.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function toRows(chart: AiChart): Record<string, string | number>[] {
  return chart.categories.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of chart.series) row[s.name] = s.values[i] ?? 0;
    return row;
  });
}

function looksTemporal(labels: string[]): boolean {
  const n = labels.filter((l) => /\d{4}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic/i.test(l)).length;
  return labels.length > 0 && n >= labels.length / 2;
}

type Props = { chart: AiChart };

export function AiChartView({ chart }: Props) {
  const { t } = useLanguage();
  const kind = chart.type === "bar" ? "column" : chart.type;
  const unit = chart.unit ?? "eur";

  if (kind === "pie") {
    return <PieLayout chart={chart} unit={unit} othersLabel={t("admin.ai.chart_others")} />;
  }

  const temporal = looksTemporal(chart.categories);
  const rows = temporal
    ? toRows(chart)
    : [...toRows(chart)].sort((a, b) => Number(b[chart.series[0]?.name] ?? 0) - Number(a[chart.series[0]?.name] ?? 0));
  const longLabels = rows.some((r) => String(r.label).length > 18);
  const horizontal = kind === "column" && chart.series.length === 1 && (longLabels || rows.length > 6);

  return (
    <Card className="border-primary/20 bg-card shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-snug">{chart.title}</CardTitle>
        {chart.period ? <CardDescription>{chart.period}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full">
          <ResponsiveContainer width="100%" height={horizontal ? Math.min(420, Math.max(220, rows.length * 44 + 48)) : 280}>
            {kind === "line" ? (
              <LineChart data={rows} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={rows.length > 8 ? -30 : 0} height={rows.length > 8 ? 56 : 32} />
                <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => formatAxis(Number(v), unit)} />
                <Tooltip formatter={(v, name) => [formatValue(Number(v), unit), String(name)]} />
                {chart.series.length > 1 ? <Legend verticalAlign="top" height={28} /> : null}
                {chart.series.map((s, i) => (
                  <Line key={s.name} type="monotone" dataKey={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            ) : horizontal ? (
              <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 48, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatAxis(Number(v), unit)} />
                <YAxis type="category" dataKey="label" width={148} tick={{ fontSize: 11 }} tickFormatter={(v) => clipLabel(String(v), 22)} />
                <Tooltip formatter={(v, name) => [formatValue(Number(v), unit), String(name)]} />
                {chart.series.map((s, i) => (
                  <Bar key={s.name} dataKey={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} barSize={18} />
                ))}
              </BarChart>
            ) : (
              <BarChart data={rows} margin={{ top: chart.series.length > 1 ? 28 : 12, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => formatAxis(Number(v), unit)} />
                <Tooltip formatter={(v, name) => [formatValue(Number(v), unit), String(name)]} />
                {chart.series.length > 1 ? <Legend verticalAlign="top" height={28} /> : null}
                {chart.series.map((s, i) => (
                  <Bar key={s.name} dataKey={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PieLayout({ chart, unit, othersLabel }: { chart: AiChart; unit: AiChartUnit; othersLabel: string }) {
  const { t } = useLanguage();
  const { slices, total } = preparePieSlices(chart, 7, othersLabel);

  return (
    <Card className="border-primary/20 bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-snug">{chart.title}</CardTitle>
        {chart.period ? <CardDescription>{chart.period}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="grid items-center gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="relative mx-auto h-[220px] w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={68}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [formatValue(Number(v), unit), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("admin.ai.chart_total")}</span>
              <span className="text-sm font-semibold tabular-nums leading-tight">{formatValue(total, unit)}</span>
            </div>
          </div>

          <div className="min-w-0 overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{t("admin.ai.chart_name")}</TableHead>
                  <TableHead className="text-right">{t("admin.ai.chart_amount")}</TableHead>
                  <TableHead className="w-16 text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slices.map((s, i) => (
                  <TableRow key={s.label}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-start gap-2">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                        <span className="leading-snug">{s.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatValue(s.value, unit)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{s.pct.toFixed(1).replace(".", ",")}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
