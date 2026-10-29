import { z } from "npm:zod@3.23.8";
import { addDays, daysBetween } from "../dates.ts";
import { MAX_ROWS, dbFail, type AiTool, type ToolContext } from "./types.ts";

type ProjectRow = {
  id: string;
  project_code: string;
  title: string;
  client_id: string;
  final_client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  responsible_company_worker_id: string | null;
  end_notice_at: string | null;
};

type MemberRow = { project_id: string; company_worker_id: string; role: string };

type ProjectStatus = "ACTIVE" | "ENDED_BY_DATE" | "UPCOMING" | "NO_DATES";

const NO_ECONOMICS_NOTE =
  "No existe facturación, coste ni presupuesto por proyecto en la base de datos; solo fechas, equipo y responsable.";

function statusOf(p: ProjectRow, today: string): ProjectStatus {
  if (!p.start_date && !p.end_date) return "NO_DATES";
  if (p.start_date && p.start_date > today) return "UPCOMING";
  if (p.end_date && p.end_date < today) return "ENDED_BY_DATE";
  return "ACTIVE";
}

async function fetchProjects(ctx: ToolContext): Promise<ProjectRow[]> {
  const { data, error } = await ctx.db
    .from("projects")
    .select("id, project_code, title, client_id, final_client_id, start_date, end_date, responsible_company_worker_id, end_notice_at")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(MAX_ROWS);
  if (error) dbFail("projects", error);
  return (data ?? []) as ProjectRow[];
}

async function fetchMembers(ctx: ToolContext, projectIds: string[]): Promise<MemberRow[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await ctx.db
    .from("project_members")
    .select("project_id, company_worker_id, role")
    .in("project_id", projectIds.slice(0, 1000))
    .limit(MAX_ROWS);
  if (error) dbFail("project_members", error);
  return (data ?? []) as MemberRow[];
}

async function clientNames(ctx: ToolContext, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await ctx.db.from("clients").select("id, trade_name, company_name").in("id", ids.slice(0, 500));
  if (error) dbFail("clients", error);
  for (const c of (data ?? []) as { id: string; trade_name: string; company_name: string }[]) {
    map.set(c.id, (c.trade_name || c.company_name || "").trim() || "Cliente sin nombre");
  }
  return map;
}

async function workerNames(ctx: ToolContext, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await ctx.db.from("company_workers").select("id, first_name, last_name").in("id", ids.slice(0, 200));
  if (error) dbFail("company_workers", error);
  for (const w of (data ?? []) as { id: string; first_name: string; last_name: string }[]) {
    map.set(w.id, `${w.first_name} ${w.last_name}`.trim());
  }
  return map;
}

// ---------------------------------------------------------------------------

export const getProjectsSummary: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_projects_summary",
      description:
        "Resumen de proyectos: nº activos, finalizados por fecha, futuros y sin fechas; proyectos que finalizan en los próximos 30 días; tamaño medio de equipo; proyectos por cliente. No hay datos económicos por proyecto.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  async run(ctx) {
    const projects = await fetchProjects(ctx);
    const members = await fetchMembers(ctx, projects.map((p) => p.id));
    const teamSize = new Map<string, number>();
    for (const m of members) teamSize.set(m.project_id, (teamSize.get(m.project_id) ?? 0) + 1);

    const counts: Record<ProjectStatus, number> = { ACTIVE: 0, ENDED_BY_DATE: 0, UPCOMING: 0, NO_DATES: 0 };
    const soonLimit = addDays(ctx.today, 30);
    const endingSoon: ProjectRow[] = [];
    const byClient = new Map<string, number>();
    for (const p of projects) {
      const st = statusOf(p, ctx.today);
      counts[st] += 1;
      if (st === "ACTIVE" && p.end_date && p.end_date <= soonLimit) endingSoon.push(p);
      byClient.set(p.client_id, (byClient.get(p.client_id) ?? 0) + 1);
    }
    const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const names = await clientNames(ctx, [...new Set([...topClients.map(([id]) => id), ...endingSoon.map((p) => p.client_id)])]);
    const activeIds = projects.filter((p) => statusOf(p, ctx.today) === "ACTIVE").map((p) => p.id);
    const avgTeam = activeIds.length
      ? Math.round((activeIds.reduce((s, id) => s + (teamSize.get(id) ?? 0), 0) / activeIds.length) * 10) / 10
      : null;

    return {
      as_of: ctx.today,
      total_projects: projects.length,
      active: counts.ACTIVE,
      ended_by_date: counts.ENDED_BY_DATE,
      upcoming: counts.UPCOMING,
      without_dates: counts.NO_DATES,
      total_assignments: members.length,
      avg_team_size_active: avgTeam,
      active_without_team: activeIds.filter((id) => !teamSize.get(id)).length,
      ending_within_30_days: endingSoon.map((p) => ({
        code: p.project_code,
        title: p.title,
        client: names.get(p.client_id) ?? "Cliente desconocido",
        end_date: p.end_date,
        days_remaining: p.end_date ? daysBetween(ctx.today, p.end_date) : null,
      })),
      projects_by_client: topClients.map(([id, n]) => ({ client: names.get(id) ?? "Cliente desconocido", projects: n })),
      note: NO_ECONOMICS_NOTE,
    };
  },
};

// ---------------------------------------------------------------------------

const PerformanceArgs = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["end_date", "days_remaining", "team_size", "duration"]).optional().default("end_date"),
  only_active: z.boolean().optional().default(true),
});

export const getProjectPerformance: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_project_performance",
      description:
        "Detalle por proyecto con las métricas existentes: estado por fechas, duración, días restantes, tamaño de equipo, roles, responsable y cliente. Útil para detectar proyectos que necesitan atención (sin equipo, sin responsable, a punto de finalizar, finalizados por fecha). No hay datos económicos por proyecto.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50 },
          sort: { type: "string", enum: ["end_date", "days_remaining", "team_size", "duration"] },
          only_active: { type: "boolean", description: "Si true (por defecto) solo proyectos activos." },
        },
        required: [],
      },
    },
  },
  async run(ctx, raw) {
    const args = PerformanceArgs.parse(raw);
    const all = await fetchProjects(ctx);
    const projects = args.only_active ? all.filter((p) => statusOf(p, ctx.today) === "ACTIVE") : all;
    const members = await fetchMembers(ctx, projects.map((p) => p.id));
    const team = new Map<string, MemberRow[]>();
    for (const m of members) {
      const l = team.get(m.project_id) ?? [];
      l.push(m);
      team.set(m.project_id, l);
    }
    const [clients, workers] = await Promise.all([
      clientNames(ctx, [...new Set(projects.map((p) => p.client_id))]),
      workerNames(ctx, [...new Set(projects.map((p) => p.responsible_company_worker_id).filter((x): x is string => !!x))]),
    ]);
    const rows = projects.map((p) => {
      const t = team.get(p.id) ?? [];
      const roles = new Map<string, number>();
      for (const m of t) roles.set(m.role, (roles.get(m.role) ?? 0) + 1);
      const duration = p.start_date && p.end_date ? daysBetween(p.start_date, p.end_date) : null;
      const remaining = p.end_date ? daysBetween(ctx.today, p.end_date) : null;
      const flags: string[] = [];
      if (t.length === 0) flags.push("sin_equipo");
      if (!p.responsible_company_worker_id) flags.push("sin_responsable");
      if (remaining !== null && remaining >= 0 && remaining <= 30) flags.push("finaliza_en_30_dias");
      if (remaining !== null && remaining < 0) flags.push("finalizado_por_fecha");
      if (!p.start_date || !p.end_date) flags.push("fechas_incompletas");
      return {
        code: p.project_code,
        title: p.title,
        client: clients.get(p.client_id) ?? "Cliente desconocido",
        status: statusOf(p, ctx.today),
        start_date: p.start_date,
        end_date: p.end_date,
        duration_days: duration,
        days_remaining: remaining,
        team_size: t.length,
        roles: [...roles.entries()].map(([role, n]) => `${role}×${n}`),
        responsible: p.responsible_company_worker_id ? workers.get(p.responsible_company_worker_id) ?? "—" : null,
        attention_flags: flags,
      };
    });
    const sorters: Record<typeof args.sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      end_date: (a, b) => (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999"),
      days_remaining: (a, b) => (a.days_remaining ?? 1e9) - (b.days_remaining ?? 1e9),
      team_size: (a, b) => a.team_size - b.team_size,
      duration: (a, b) => (b.duration_days ?? -1) - (a.duration_days ?? -1),
    };
    rows.sort(sorters[args.sort]);
    return {
      as_of: ctx.today,
      only_active: args.only_active,
      total: rows.length,
      shown: Math.min(rows.length, args.limit),
      projects: rows.slice(0, args.limit),
      note: NO_ECONOMICS_NOTE,
    };
  },
};

export const projectTools: AiTool[] = [getProjectsSummary, getProjectPerformance];
