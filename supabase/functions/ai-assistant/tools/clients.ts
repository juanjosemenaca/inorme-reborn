import { hasModule } from "../permissions.ts";
import { addDays, round2 } from "../dates.ts";
import { MAX_ROWS, dbFail, num, type AiTool, type ToolContext } from "./types.ts";

type ClientRow = {
  id: string;
  trade_name: string;
  company_name: string;
  client_kind: string;
  active: boolean;
  created_at: string;
};

async function fetchClients(ctx: ToolContext): Promise<ClientRow[]> {
  const { data, error } = await ctx.db
    .from("clients")
    .select("id, trade_name, company_name, client_kind, active, created_at")
    .limit(MAX_ROWS);
  if (error) dbFail("clients", error);
  return (data ?? []) as ClientRow[];
}

export const getClientsSummary: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_clients_summary",
      description:
        "Resumen de clientes: total, activos e inactivos, por tipo (final / intermediario), altas en los últimos 12 meses, clientes con proyectos y, si el usuario tiene acceso a facturación, clientes con facturas en los últimos 12 meses y sin facturar.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  async run(ctx) {
    const clients = await fetchClients(ctx);
    const yearAgo = addDays(ctx.today, -365);
    const name = (c: ClientRow) => (c.trade_name || c.company_name || "").trim() || "Cliente sin nombre";

    const { data: projRows, error: pErr } = await ctx.db.from("projects").select("client_id").limit(MAX_ROWS);
    if (pErr) dbFail("projects", pErr);
    const projectsByClient = new Map<string, number>();
    for (const p of (projRows ?? []) as { client_id: string }[]) {
      projectsByClient.set(p.client_id, (projectsByClient.get(p.client_id) ?? 0) + 1);
    }

    const out: Record<string, unknown> = {
      as_of: ctx.today,
      total_clients: clients.length,
      active: clients.filter((c) => c.active).length,
      inactive: clients.filter((c) => !c.active).length,
      by_kind: {
        FINAL: clients.filter((c) => c.client_kind === "FINAL").length,
        INTERMEDIARIO: clients.filter((c) => c.client_kind === "INTERMEDIARIO").length,
      },
      new_last_12_months: clients.filter((c) => c.created_at.slice(0, 10) >= yearAgo).length,
      clients_with_projects: projectsByClient.size,
      active_clients_without_projects: clients
        .filter((c) => c.active && !projectsByClient.has(c.id))
        .slice(0, 25)
        .map(name),
    };

    if (hasModule(ctx.principal, "FACTURACION")) {
      const { data: inv, error: iErr } = await ctx.db
        .from("billing_invoices")
        .select("client_id, grand_total")
        .in("status", ["ISSUED", "PAID"])
        .gte("issue_date", yearAgo)
        .lte("issue_date", ctx.today)
        .limit(MAX_ROWS);
      if (iErr) dbFail("billing_invoices", iErr);
      const billed = new Map<string, number>();
      for (const r of (inv ?? []) as { client_id: string; grand_total: string | number }[]) {
        billed.set(r.client_id, (billed.get(r.client_id) ?? 0) + num(r.grand_total));
      }
      out.billing_last_12_months = {
        clients_with_invoices: billed.size,
        active_clients_without_invoices: clients
          .filter((c) => c.active && !billed.has(c.id))
          .slice(0, 25)
          .map(name),
        top_clients: [...billed.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id, total]) => ({
            client: (() => {
              const c = clients.find((x) => x.id === id);
              return c ? name(c) : "Cliente desconocido";
            })(),
            invoiced_total: round2(total),
          })),
      };
    } else {
      out.billing_note = "El usuario no tiene acceso a facturación; no se incluyen datos de facturas.";
    }
    return out;
  },
};

export const clientTools: AiTool[] = [getClientsSummary];
