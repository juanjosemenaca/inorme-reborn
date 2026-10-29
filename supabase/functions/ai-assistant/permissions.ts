/**
 * Permisos del Asistente IA. Única fuente de verdad en el servidor.
 * El rol y los módulos se leen SIEMPRE de `backoffice_users` con la sesión autenticada,
 * nunca del cuerpo de la petición.
 */

export type UserRole = "ADMIN" | "WORKER";

export type WorkerModuleKey =
  | "VACATIONS"
  | "MESSAGES"
  | "TIME_CLOCK"
  | "AGENDA"
  | "GASTOS"
  | "FACTURACION"
  | "DMS"
  | "ADMIN_COMPANY_WORKERS"
  | "ADMIN_CLIENTS"
  | "ADMIN_PROJECTS"
  | "ADMIN_PROVIDERS";

export type AiPrincipal = {
  backofficeUserId: string;
  authUserId: string;
  role: UserRole;
  enabledModules: WorkerModuleKey[];
  companyWorkerId: string | null;
};

/** Módulos de datos que el asistente sabe consultar. */
export const AI_DATA_MODULES: readonly WorkerModuleKey[] = [
  "FACTURACION",
  "GASTOS",
  "ADMIN_PROJECTS",
  "ADMIN_CLIENTS",
];

const REGISTRY_MODULES: readonly WorkerModuleKey[] = [
  "ADMIN_COMPANY_WORKERS",
  "ADMIN_CLIENTS",
  "ADMIN_PROJECTS",
  "ADMIN_PROVIDERS",
];

/**
 * Misma regla que `isWorkerModuleEnabled` en el frontend (src/lib/workerModules.ts):
 * ADMIN tiene siempre DMS, FACTURACION y maestros; el resto depende de la ficha.
 * Excepción documentada: ADMIN también tiene GASTOS, porque ya ve y valida todas las hojas
 * de gastos en `/admin/gastos-trabajadores` (ruta solo por rol, sin módulo).
 */
export function hasModule(principal: AiPrincipal, module: WorkerModuleKey): boolean {
  if (principal.role === "ADMIN" && (module === "DMS" || module === "FACTURACION" || module === "GASTOS")) return true;
  if (principal.role === "ADMIN" && REGISTRY_MODULES.includes(module)) return true;
  return principal.enabledModules.includes(module);
}

/** Quién puede abrir el asistente. */
export function canUseAssistant(principal: AiPrincipal): boolean {
  if (principal.role === "ADMIN") return true;
  return AI_DATA_MODULES.some((m) => hasModule(principal, m));
}

/** Módulo necesario por herramienta. `null` = basta con poder usar el asistente. */
export const TOOL_MODULES: Record<string, WorkerModuleKey | null> = {
  get_billing_summary: "FACTURACION",
  get_top_clients_by_billing: "FACTURACION",
  get_pending_invoices: "FACTURACION",
  get_invoice_list: "FACTURACION",
  get_billing_comparison: "FACTURACION",
  get_client_billing_comparison: "FACTURACION",
  get_expenses_summary: "GASTOS",
  get_top_expense_categories: "GASTOS",
  get_projects_summary: "ADMIN_PROJECTS",
  get_project_performance: "ADMIN_PROJECTS",
  get_clients_summary: "ADMIN_CLIENTS",
  get_data_catalog: null,
  render_report: null,
  render_chart: null,
};

/** Herramientas del Dashboard Builder. La fuente de datos se valida en el run(), no aquí. */
export const DASHBOARD_TOOL_MODULES: Record<string, WorkerModuleKey | null> = {
  list_dashboard_widgets: null,
  create_dashboard_widget: null,
  update_dashboard_widget: null,
  delete_dashboard_widget: null,
  move_dashboard_widget: null,
  resize_dashboard_widget: null,
  clear_dashboard: null,
  duplicate_dashboard_widget: null,
  propose_dashboard_layout: null,
  apply_dashboard_layout: null,
  schedule_dashboard_widget: null,
};

const ALL_TOOL_MODULES: Record<string, WorkerModuleKey | null> = {
  ...TOOL_MODULES,
  ...DASHBOARD_TOOL_MODULES,
};

export type AiIntent = "chat" | "dashboard";

export type PermissionResult = { allowed: true } | { allowed: false; reason: string };

/** Comprobación centralizada de permiso para una herramienta. */
export function checkAiPermission(principal: AiPrincipal, toolName: string, intent?: AiIntent): PermissionResult {
  const map =
    intent === "dashboard" ? DASHBOARD_TOOL_MODULES : intent === "chat" ? TOOL_MODULES : ALL_TOOL_MODULES;
  if (!(toolName in map)) {
    return { allowed: false, reason: "unknown_tool" };
  }
  if (!canUseAssistant(principal)) {
    return { allowed: false, reason: "assistant_not_allowed" };
  }
  const required = map[toolName];
  if (required && !hasModule(principal, required)) {
    return { allowed: false, reason: `module_required:${required}` };
  }
  return { allowed: true };
}

/** Herramientas que el usuario puede usar (para no ofrecérselas al modelo si no procede). */
export function allowedToolNames(principal: AiPrincipal, intent: AiIntent = "chat"): string[] {
  const map = intent === "dashboard" ? DASHBOARD_TOOL_MODULES : TOOL_MODULES;
  return Object.keys(map).filter((name) => checkAiPermission(principal, name, intent).allowed);
}

/**
 * Ámbito de gastos: ADMIN ve todos los trabajadores; WORKER solo su propia ficha.
 * Devuelve `null` para "todos" o el id de trabajador al que restringir.
 */
export function expensesScope(principal: AiPrincipal): { all: true } | { all: false; companyWorkerId: string | null } {
  if (principal.role === "ADMIN") return { all: true };
  return { all: false, companyWorkerId: principal.companyWorkerId };
}
