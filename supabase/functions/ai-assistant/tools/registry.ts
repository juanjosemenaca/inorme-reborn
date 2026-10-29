import { billingTools } from "./billing.ts";
import { catalogTools } from "./catalog.ts";
import { expenseTools } from "./expenses.ts";
import { projectTools } from "./projects.ts";
import { clientTools } from "./clients.ts";
import { DASHBOARD_TOOLS } from "./dashboard.ts";
import type { AiIntent } from "../permissions.ts";
import type { AiTool } from "./types.ts";

function toolName(t: AiTool): string {
  return "function" in t.definition ? t.definition.function.name : t.definition.name;
}

/** Todas las herramientas de datos. `render_report` se gestiona aparte en el orquestador. */
export const DATA_TOOLS: AiTool[] = [...billingTools, ...catalogTools, ...expenseTools, ...projectTools, ...clientTools];

export { DASHBOARD_TOOLS };

const DATA_BY_NAME = new Map(DATA_TOOLS.map((t) => [toolName(t), t]));
const DASHBOARD_BY_NAME = new Map(DASHBOARD_TOOLS.map((t) => [toolName(t), t]));

/**
 * Resuelve una tool según el intent. Sin intent (o `chat`) no se exponen tools de dashboard.
 */
export function getTool(name: string, intent: AiIntent = "chat"): AiTool | undefined {
  if (intent === "dashboard") return DASHBOARD_BY_NAME.get(name);
  return DATA_BY_NAME.get(name);
}
