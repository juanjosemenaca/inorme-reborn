import type { AIChatRequest, AIChatResponse, AIProvider, AIToolCall } from "./types.ts";

/**
 * Proveedor de desarrollo: no llama a ningún modelo ni genera coste.
 * Devuelve respuestas deterministas y, si hay herramientas, una llamada controlada.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock" as const;
  readonly model: string;

  constructor(model = "mock-inorme") {
    this.model = model;
  }

  supportsToolCalling(): boolean {
    return true;
  }

  supportsStructuredOutput(): boolean {
    return true;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const text = lastUser && lastUser.role === "user" ? lastUser.content : "";
    const names = new Set((request.tools ?? []).map((t) => t.name));

    const alreadyHadTools = request.messages.some((m) => m.role === "tool");
    if (alreadyHadTools) {
      const lastTool = [...request.messages].reverse().find((m) => m.role === "tool");
      const toolName = lastTool && lastTool.role === "tool" ? lastTool.name : "";
      if (toolName.startsWith("create_dashboard") || toolName === "apply_dashboard_layout") {
        return { content: "He actualizado tu panel con los widgets pedidos. Puedes deshacer el cambio si no encaja.", tool_calls: [] };
      }
      if (toolName === "propose_dashboard_layout") {
        return {
          content:
            "Voy a crear:\n\n✓ Facturación del mes\n✓ Pendiente de cobro\n✓ Facturas vencidas\n✓ Evolución últimos 30 días\n✓ Top 10 clientes\n\n¿Quieres aplicarlo?",
          tool_calls: [],
        };
      }
      if (toolName === "delete_dashboard_widget") {
        return { content: "He quitado ese widget de tu panel.", tool_calls: [] };
      }
      if (toolName === "move_dashboard_widget") {
        return { content: "He colocado el gráfico arriba.", tool_calls: [] };
      }
      if (toolName === "resize_dashboard_widget") {
        return { content: "He hecho el gráfico más grande.", tool_calls: [] };
      }
      if (toolName === "schedule_dashboard_widget") {
        return { content: "He dejado programado ese resumen para los lunes (el ejecutor automático aún no está activo).", tool_calls: [] };
      }
      return {
        content:
          "Respuesta de prueba (mock). Los datos anteriores proceden de las herramientas de Inorme, no de un modelo externo.",
        tool_calls: [],
      };
    }

    const calls: AIToolCall[] = [];
    const lower = text.toLowerCase();
    const pick = (name: string, args: unknown) => {
      if (names.has(name)) calls.push({ id: `mock-${name}`, name, arguments: args });
    };

    if (names.has("create_dashboard_widget") || names.has("propose_dashboard_layout")) {
      if (/aplica|aplicar/.test(lower) && names.has("apply_dashboard_layout")) {
        pick("apply_dashboard_layout", { replace: true });
      } else if (/quita|elimina|sacar/.test(lower) && names.has("delete_dashboard_widget")) {
        const title_query = /vencid/.test(lower)
          ? "vencid"
          : /gasto/.test(lower)
            ? "gasto"
            : text.slice(0, 40);
        pick("delete_dashboard_widget", { title_query });
      } else if ((/arriba|mueve|pon /.test(lower) && /gr[aá]fico/.test(lower)) && names.has("move_dashboard_widget")) {
        pick("move_dashboard_widget", { title_query: "gráfico", position: { x: 0, y: 0 } });
      } else if (/m[aá]s grande|hazlo grande|ampl[ií]a/.test(lower) && names.has("resize_dashboard_widget")) {
        pick("resize_dashboard_widget", { title_query: "gráfico", width: 12, height: 5 });
      } else if ((/lunes|cada |programa/.test(lower)) && names.has("schedule_dashboard_widget")) {
        pick("schedule_dashboard_widget", { title_query: "resumen", frequency: "weekly", weekday: 1, hour: 8 });
      } else if (/resumen ejecutivo|informe/.test(lower) && names.has("create_dashboard_widget")) {
        pick("create_dashboard_widget", {
          type: "AI_REPORT",
          title: "Resumen ejecutivo de facturación",
          config: {
            source: "billing",
            prompt: "Resume los principales cambios de facturación y gastos.",
            period: "current_month",
          },
          position: { x: 0, y: 10 },
          width: 12,
          height: 5,
        });
      } else if (
        (/panel|dashboard|completo|tres kpi|controlar la factur/.test(lower) || /quiero un panel/.test(lower)) &&
        names.has("propose_dashboard_layout")
      ) {
        pick("propose_dashboard_layout", {
          summary: "Panel de facturación con KPIs, evolución y ranking de clientes.",
          widgets: [
            { type: "KPI", title: "Facturación del mes", config: { source: "billing", metric: "total", period: "current_month" }, position: { x: 0, y: 0 }, width: 4, height: 2 },
            { type: "KPI", title: "Pendiente de cobro", config: { source: "billing", metric: "pending_amount", period: "current_month" }, position: { x: 4, y: 0 }, width: 4, height: 2 },
            { type: "KPI", title: "Facturas vencidas", config: { source: "billing", metric: "overdue_count", period: "current_month" }, position: { x: 8, y: 0 }, width: 4, height: 2 },
            { type: "LINE_CHART", title: "Facturación últimos 30 días", config: { source: "billing", metric: "total", period: "last_30_days", groupBy: "day" }, position: { x: 0, y: 2 }, width: 8, height: 4 },
            { type: "RANKING", title: "Top 10 clientes", config: { source: "billing", dataset: "top_clients", period: "current_month", limit: 10 }, position: { x: 8, y: 2 }, width: 4, height: 4 },
          ],
        });
      } else if ((/gr[aá]fico|a[nñ]ade/.test(lower)) && names.has("create_dashboard_widget")) {
        pick("create_dashboard_widget", {
          type: "LINE_CHART",
          title: "Facturación últimos 30 días",
          config: { source: "billing", metric: "total", period: "last_30_days", groupBy: "day" },
          position: { x: 0, y: 4 },
          width: 8,
          height: 4,
        });
      } else if (names.has("list_dashboard_widgets")) {
        pick("list_dashboard_widgets", {});
      }
    } else if ((/gr[aá]fico|quesito|pastel|columnas|barras/.test(lower)) && names.has("render_chart")) {
      pick("render_chart", {
        type: /quesito|pastel/.test(lower) ? "pie" : "column",
        title: "Gráfico de prueba (mock)",
        period: "periodo de prueba",
        unit: "eur",
        categories: ["A", "B"],
        series: [{ name: "Mock", values: [60, 40] }],
      });
    } else if (/informe/.test(lower) && names.has("render_report")) {
      pick("render_report", {
        title: "Informe de prueba (mock)",
        period: "periodo de prueba",
        summary: "Este informe lo genera MockAIProvider. No contiene datos reales.",
        kpis: [{ label: "Modo", value: "mock" }],
        sections: [{ title: "Nota", content: "Cambia `AI_PROVIDER` a `openai` u `ollama` para datos reales." }],
      });
    } else if ((/campos|qu[eé] guardamos|modelo de datos/.test(lower)) && names.has("get_data_catalog")) {
      pick("get_data_catalog", { topic: "invoice" });
    } else if (/factur|cliente/.test(lower) && names.has("get_billing_summary")) {
      pick("get_billing_summary", { start_date: "2026-10-01", end_date: "2026-10-31", compare_previous_period: false });
    } else if (/gasto/.test(lower) && names.has("get_expenses_summary")) {
      pick("get_expenses_summary", { start_date: "2026-10-01", end_date: "2026-10-31" });
    } else if (/proyecto/.test(lower) && names.has("get_projects_summary")) {
      pick("get_projects_summary", {});
    }

    if (calls.length) return { content: null, tool_calls: calls };

    return {
      content: [
        "Respuesta de **MockAIProvider** (sin llamada a OpenAI ni Ollama).",
        "",
        text ? `Has preguntado: «${text.slice(0, 200)}»` : "No hay mensaje de usuario.",
        "",
        names.size
          ? `Herramientas disponibles en esta sesión: ${[...names].join(", ")}.`
          : "Esta sesión no tiene herramientas de datos.",
      ].join("\n"),
      tool_calls: [],
    };
  }
}
