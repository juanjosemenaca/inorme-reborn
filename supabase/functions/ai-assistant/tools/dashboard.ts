import { z } from "npm:zod@3.23.8";
import { ToolError, dbFail, type AiTool, type ToolContext } from "./types.ts";
import {
  PositionSchema,
  WIDGET_TYPES,
  WidgetConfigSchema,
  allowedSources,
  defaultSize,
  validateWidgetConfig,
  type WidgetType,
} from "./dashboardCatalog.ts";

type WidgetRow = {
  id: string;
  user_id: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  width: number;
  height: number;
  enabled: boolean;
};

const TypeSchema = z.enum(WIDGET_TYPES);
const IdSchema = z.string().uuid();

const CreateSchema = z.object({
  type: TypeSchema,
  title: z.string().min(1).max(120),
  config: WidgetConfigSchema,
  position: PositionSchema.optional(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(8).optional(),
});

const UpdateSchema = z.object({
  widget_id: IdSchema.optional(),
  title_query: z.string().max(80).optional(),
  title: z.string().min(1).max(120).optional(),
  type: TypeSchema.optional(),
  config: WidgetConfigSchema.optional(),
  position: PositionSchema.optional(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(8).optional(),
  enabled: z.boolean().optional(),
});

const LocateSchema = z.object({
  widget_id: IdSchema.optional(),
  title_query: z.string().max(80).optional(),
});

const MoveSchema = LocateSchema.extend({
  position: PositionSchema,
});

const ResizeSchema = LocateSchema.extend({
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(8).optional(),
});

const ProposeSchema = z.object({
  widgets: z.array(CreateSchema).min(1).max(20),
  summary: z.string().max(500).optional(),
});

const ScheduleSchema = LocateSchema.extend({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  hour: z.number().int().min(0).max(23).optional(),
  weekday: z.number().int().min(1).max(7).optional(),
  active: z.boolean().optional(),
});

function compact(w: WidgetRow) {
  return {
    id: w.id,
    type: w.type,
    title: w.title,
    config: w.config,
    position: w.position,
    width: w.width,
    height: w.height,
  };
}

async function listOwn(ctx: ToolContext): Promise<WidgetRow[]> {
  const { data, error } = await ctx.db
    .from("dashboard_widgets")
    .select("id, user_id, type, title, config, position, width, height, enabled")
    .eq("user_id", ctx.principal.backofficeUserId)
    .order("created_at", { ascending: true });
  if (error) dbFail("dashboard_widgets", error);
  return (data ?? []) as WidgetRow[];
}

async function locate(ctx: ToolContext, widget_id?: string, title_query?: string, destructive = false): Promise<WidgetRow> {
  const all = await listOwn(ctx);
  if (widget_id) {
    const found = all.find((w) => w.id === widget_id);
    if (!found) throw new ToolError("not_found", "No he encontrado ese widget en tu panel.");
    return found;
  }
  const q = (title_query ?? "").trim().toLowerCase();
  if (!q) {
    if (!destructive && all.length === 1) return all[0];
    throw new ToolError("ambiguous", "Indica qué widget (título o id). No haré el cambio a ciegas.");
  }
  const matches = all.filter(
    (w) => w.title.toLowerCase().includes(q) || w.type.toLowerCase().includes(q.replace(/\s+/g, "_"))
  );
  if (matches.length === 0) throw new ToolError("not_found", `No he encontrado un widget que coincida con «${title_query}».`);
  if (matches.length > 1) {
    throw new ToolError(
      "ambiguous",
      `No estoy seguro de cuál quieres. Coinciden: ${matches.map((m) => m.title).join("; ")}.`
    );
  }
  return matches[0];
}

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): AiTool["definition"] {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

const CONFIG_PROPS = {
  source: { type: "string", enum: ["billing", "expenses", "projects", "clients"] },
  metric: {
    type: "string",
    description:
      "Obligatoria salvo AI_REPORT/TABLE/RANKING. billing: total, invoice_count, pending_amount, overdue_count, collected_total. expenses: total, sheet_count. projects: active_count, ending_soon_count, without_team_count. clients: active_count, total_count. No inventes otros nombres.",
  },
  dataset: {
    type: "string",
    description:
      "Obligatorio en TABLE/RANKING. billing: pending_invoices, top_clients. expenses: top_categories. projects: ending_soon, attention. clients: active_without_projects.",
  },
  period: {
    type: "string",
    enum: ["current_month", "previous_month", "last_30_days", "last_12_months", "current_year", "previous_day"],
  },
  groupBy: { type: "string", enum: ["day", "month"] },
  limit: { type: "integer", minimum: 1, maximum: 25 },
  prompt: { type: "string", description: "Solo para AI_REPORT: instrucción, no el resultado." },
};

const CREATE_PROPS = {
  type: { type: "string", enum: [...WIDGET_TYPES] },
  title: { type: "string" },
  config: { type: "object", properties: CONFIG_PROPS, additionalProperties: false },
  position: {
    type: "object",
    properties: { x: { type: "integer" }, y: { type: "integer" } },
  },
  width: { type: "integer", minimum: 1, maximum: 12 },
  height: { type: "integer", minimum: 1, maximum: 8 },
};

export const listDashboardWidgets: AiTool = {
  definition: fn(
    "list_dashboard_widgets",
    "Lista los widgets del panel personal del usuario autenticado (nunca los de otro usuario).",
    {}
  ),
  async run(ctx) {
    const rows = await listOwn(ctx);
    return { widgets: rows.map(compact), allowed_sources: allowedSources(ctx.principal) };
  },
};

export const createDashboardWidget: AiTool = {
  definition: fn(
    "create_dashboard_widget",
    "Crea un widget en el panel del usuario. No genera HTML/JSX/SQL. Usa tipos y fuentes del catálogo.",
    CREATE_PROPS,
    ["type", "title", "config"]
  ),
  async run(ctx, raw) {
    const args = CreateSchema.parse(raw);
    const issue = validateWidgetConfig(args.type, args.config, ctx.principal);
    if (issue) throw new ToolError("invalid_config", issue);
    const size = defaultSize(args.type);
    const { data, error } = await ctx.db
      .from("dashboard_widgets")
      .insert({
        user_id: ctx.principal.backofficeUserId,
        type: args.type,
        title: args.title.trim(),
        config: args.config,
        position: args.position ?? { x: 0, y: 99 },
        width: args.width ?? size.width,
        height: args.height ?? size.height,
        enabled: true,
      })
      .select("id, user_id, type, title, config, position, width, height, enabled")
      .single();
    if (error) dbFail("dashboard_widgets_insert", error);
    return { ok: true, widget: compact(data as WidgetRow) };
  },
};

export const updateDashboardWidget: AiTool = {
  definition: fn(
    "update_dashboard_widget",
    "Modifica título, config, tamaño o posición de un widget propio. Localiza por widget_id o title_query.",
    {
      widget_id: { type: "string", format: "uuid" },
      title_query: { type: "string" },
      title: { type: "string" },
      config: { type: "object", properties: CONFIG_PROPS, additionalProperties: false },
      position: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } } },
      width: { type: "integer" },
      height: { type: "integer" },
    }
  ),
  async run(ctx, raw) {
    const args = UpdateSchema.parse(raw);
    const current = await locate(ctx, args.widget_id, args.title_query);
    const nextType = args.type ?? current.type;
    const nextConfig = args.config ?? (current.config as z.infer<typeof WidgetConfigSchema>);
    if (args.config || args.type) {
      const parsed = WidgetConfigSchema.parse(nextConfig);
      const issue = validateWidgetConfig(nextType, parsed, ctx.principal);
      if (issue) throw new ToolError("invalid_config", issue);
    }
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.config !== undefined) patch.config = args.config;
    if (args.type !== undefined) patch.type = args.type;
    if (args.position !== undefined) patch.position = args.position;
    if (args.width !== undefined) patch.width = args.width;
    if (args.height !== undefined) patch.height = args.height;
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (Object.keys(patch).length === 0) return { ok: true, widget: compact(current) };
    const { data, error } = await ctx.db
      .from("dashboard_widgets")
      .update(patch)
      .eq("id", current.id)
      .select("id, user_id, type, title, config, position, width, height, enabled")
      .single();
    if (error) dbFail("dashboard_widgets_update", error);
    return { ok: true, widget: compact(data as WidgetRow) };
  },
};

export const deleteDashboardWidget: AiTool = {
  definition: fn(
    "delete_dashboard_widget",
    "Elimina un widget propio. Si title_query es ambiguo, NO elimines: pide aclaración.",
    { widget_id: { type: "string", format: "uuid" }, title_query: { type: "string" } }
  ),
  async run(ctx, raw) {
    const args = LocateSchema.parse(raw);
    const current = await locate(ctx, args.widget_id, args.title_query, true);
    const { error } = await ctx.db.from("dashboard_widgets").delete().eq("id", current.id);
    if (error) dbFail("dashboard_widgets_delete", error);
    return { ok: true, deleted_id: current.id, title: current.title };
  },
};

export const moveDashboardWidget: AiTool = {
  definition: fn(
    "move_dashboard_widget",
    "Cambia la posición de un widget existente. No lo borres ni lo recrees.",
    {
      widget_id: { type: "string", format: "uuid" },
      title_query: { type: "string" },
      position: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
    },
    ["position"]
  ),
  async run(ctx, raw) {
    const args = MoveSchema.parse(raw);
    const current = await locate(ctx, args.widget_id, args.title_query);
    const { data, error } = await ctx.db
      .from("dashboard_widgets")
      .update({ position: args.position })
      .eq("id", current.id)
      .select("id, user_id, type, title, config, position, width, height, enabled")
      .single();
    if (error) dbFail("dashboard_widgets_move", error);
    return { ok: true, widget: compact(data as WidgetRow) };
  },
};

export const resizeDashboardWidget: AiTool = {
  definition: fn(
    "resize_dashboard_widget",
    "Cambia width (1-12) y/o height (1-8) de un widget propio.",
    {
      widget_id: { type: "string", format: "uuid" },
      title_query: { type: "string" },
      width: { type: "integer", minimum: 1, maximum: 12 },
      height: { type: "integer", minimum: 1, maximum: 8 },
    }
  ),
  async run(ctx, raw) {
    const args = ResizeSchema.parse(raw);
    if (args.width === undefined && args.height === undefined) {
      throw new ToolError("invalid_args", "Indica width y/o height.");
    }
    const current = await locate(ctx, args.widget_id, args.title_query);
    const patch: Record<string, unknown> = {};
    if (args.width !== undefined) patch.width = args.width;
    if (args.height !== undefined) patch.height = args.height;
    const { data, error } = await ctx.db
      .from("dashboard_widgets")
      .update(patch)
      .eq("id", current.id)
      .select("id, user_id, type, title, config, position, width, height, enabled")
      .single();
    if (error) dbFail("dashboard_widgets_resize", error);
    return { ok: true, widget: compact(data as WidgetRow) };
  },
};

export const clearDashboard: AiTool = {
  definition: fn("clear_dashboard", "Elimina todos los widgets del panel del usuario autenticado.", {}),
  async run(ctx) {
    const { error } = await ctx.db.from("dashboard_widgets").delete().eq("user_id", ctx.principal.backofficeUserId);
    if (error) dbFail("dashboard_widgets_clear", error);
    return { ok: true };
  },
};

export const duplicateDashboardWidget: AiTool = {
  definition: fn(
    "duplicate_dashboard_widget",
    "Duplica un widget propio.",
    { widget_id: { type: "string", format: "uuid" }, title_query: { type: "string" } }
  ),
  async run(ctx, raw) {
    const args = LocateSchema.parse(raw);
    const current = await locate(ctx, args.widget_id, args.title_query);
    const { data, error } = await ctx.db
      .from("dashboard_widgets")
      .insert({
        user_id: ctx.principal.backofficeUserId,
        type: current.type,
        title: `${current.title} (copia)`,
        config: current.config,
        position: { x: current.position?.x ?? 0, y: (current.position?.y ?? 0) + 1 },
        width: current.width,
        height: current.height,
        enabled: true,
      })
      .select("id, user_id, type, title, config, position, width, height, enabled")
      .single();
    if (error) dbFail("dashboard_widgets_duplicate", error);
    return { ok: true, widget: compact(data as WidgetRow) };
  },
};

export const proposeDashboardLayout: AiTool = {
  definition: fn(
    "propose_dashboard_layout",
    "Propone un layout completo SIN aplicarlo. Guarda un plan pendiente para que el usuario pulse Aplicar.",
    {
      summary: { type: "string" },
      widgets: { type: "array", items: { type: "object", properties: CREATE_PROPS } },
    },
    ["widgets"]
  ),
  async run(ctx, raw) {
    const args = ProposeSchema.parse(raw);
    for (const w of args.widgets) {
      const issue = validateWidgetConfig(w.type, w.config, ctx.principal);
      if (issue) throw new ToolError("invalid_config", `${w.title}: ${issue}`);
    }
    const { error } = await ctx.db.from("dashboard_preferences").upsert({
      user_id: ctx.principal.backofficeUserId,
      pending_layout: args.widgets,
      updated_at: new Date().toISOString(),
    });
    if (error) dbFail("dashboard_preferences_pending", error);
    return {
      ok: true,
      pending: true,
      summary: args.summary ?? "Plan de panel listo para aplicar.",
      widgets: args.widgets.map((w) => w.title),
    };
  },
};

export const applyDashboardLayout: AiTool = {
  definition: fn(
    "apply_dashboard_layout",
    "Aplica el plan pendiente (propose_dashboard_layout). Crea los widgets del plan en el panel del usuario.",
    { replace: { type: "boolean", description: "Si true, vacía el panel antes de crear." } }
  ),
  async run(ctx, raw) {
    const args = z.object({ replace: z.boolean().optional() }).parse(raw ?? {});
    const { data, error } = await ctx.db.rpc("apply_own_dashboard_layout", { p_replace: args.replace ?? false });
    if (!error) {
      const row = data as { ok?: boolean; created?: string[] } | null;
      return { ok: row?.ok === true, created: Array.isArray(row?.created) ? row.created : [] };
    }
    const { data: pref, error: prefErr } = await ctx.db
      .from("dashboard_preferences")
      .select("pending_layout")
      .eq("user_id", ctx.principal.backofficeUserId)
      .maybeSingle();
    if (prefErr) dbFail("dashboard_preferences_read", prefErr);
    const pending = ProposeSchema.shape.widgets.parse(pref?.pending_layout ?? []);
    if (!pending.length) throw new ToolError("no_pending", "No hay un plan pendiente para aplicar.");
    if (args.replace) {
      const { error: delErr } = await ctx.db.from("dashboard_widgets").delete().eq("user_id", ctx.principal.backofficeUserId);
      if (delErr) dbFail("dashboard_widgets_replace", delErr);
    }
    const created: string[] = [];
    try {
      for (const w of pending) {
        const issue = validateWidgetConfig(w.type, w.config, ctx.principal);
        if (issue) throw new ToolError("invalid_config", `${w.title}: ${issue}`);
        const size = defaultSize(w.type);
        const { data: row, error: insErr } = await ctx.db
          .from("dashboard_widgets")
          .insert({
            user_id: ctx.principal.backofficeUserId,
            type: w.type,
            title: w.title.trim(),
            config: w.config,
            position: w.position ?? { x: 0, y: created.length },
            width: w.width ?? size.width,
            height: w.height ?? size.height,
            enabled: true,
          })
          .select("id, title")
          .single();
        if (insErr) dbFail("dashboard_widgets_apply", insErr);
        created.push((row as { title: string }).title);
      }
    } catch (e) {
      if (args.replace && created.length) {
        await ctx.db.from("dashboard_widgets").delete().eq("user_id", ctx.principal.backofficeUserId);
      }
      throw e;
    }
    await ctx.db
      .from("dashboard_preferences")
      .update({ pending_layout: null, updated_at: new Date().toISOString() })
      .eq("user_id", ctx.principal.backofficeUserId);
    return { ok: true, created };
  },
};

export const scheduleDashboardWidget: AiTool = {
  definition: fn(
    "schedule_dashboard_widget",
    "Guarda una programación (infraestructura). No ejecuta el scheduler todavía.",
    {
      widget_id: { type: "string", format: "uuid" },
      title_query: { type: "string" },
      frequency: { type: "string", enum: ["daily", "weekly", "monthly"] },
      hour: { type: "integer", minimum: 0, maximum: 23 },
      weekday: { type: "integer", minimum: 1, maximum: 7, description: "1=lunes … 7=domingo" },
    },
    ["frequency"]
  ),
  async run(ctx, raw) {
    const args = ScheduleSchema.parse(raw);
    const current = await locate(ctx, args.widget_id, args.title_query);
    const { data, error } = await ctx.db
      .from("dashboard_schedules")
      .insert({
        user_id: ctx.principal.backofficeUserId,
        widget_id: current.id,
        frequency: args.frequency,
        hour: args.hour ?? 8,
        weekday: args.frequency === "weekly" ? args.weekday ?? 1 : args.weekday ?? null,
        active: args.active ?? true,
      })
      .select("id, frequency, hour, weekday, active")
      .single();
    if (error) dbFail("dashboard_schedules_insert", error);
    return { ok: true, schedule: data, note: "Programación guardada. El ejecutor automático aún no está activo." };
  },
};

export const DASHBOARD_TOOLS: AiTool[] = [
  listDashboardWidgets,
  createDashboardWidget,
  updateDashboardWidget,
  deleteDashboardWidget,
  moveDashboardWidget,
  resizeDashboardWidget,
  clearDashboard,
  duplicateDashboardWidget,
  proposeDashboardLayout,
  applyDashboardLayout,
  scheduleDashboardWidget,
];
