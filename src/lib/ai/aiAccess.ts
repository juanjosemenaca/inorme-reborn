import type { UserRole, WorkerModuleKey } from "@/types/backoffice";
import { isWorkerModuleEnabled } from "@/lib/workerModules";

/**
 * Módulos de datos que el asistente sabe consultar.
 * Debe coincidir con `AI_DATA_MODULES` en `supabase/functions/ai-assistant/permissions.ts`.
 */
export const AI_DATA_MODULES: readonly WorkerModuleKey[] = [
  "FACTURACION",
  "GASTOS",
  "ADMIN_PROJECTS",
  "ADMIN_CLIENTS",
];

/**
 * Regla de acceso al asistente (solo para mostrar/ocultar UI; la decisión real es del servidor):
 * ADMIN siempre; WORKER si tiene al menos un módulo de datos.
 */
export function canUseAiAssistant(
  role: UserRole | null | undefined,
  enabledModules: readonly WorkerModuleKey[] | null | undefined
): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  const mods = enabledModules ?? [];
  return AI_DATA_MODULES.some((m) => isWorkerModuleEnabled(role, mods, m));
}

/**
 * Áreas consultables (para los prompts sugeridos).
 * ADMIN: todas (incluye GASTOS, ya que valida todas las hojas en /admin/gastos-trabajadores).
 * Misma regla que `hasModule` en la Edge Function.
 */
export function aiAvailableAreas(
  role: UserRole | null | undefined,
  enabledModules: readonly WorkerModuleKey[] | null | undefined
): WorkerModuleKey[] {
  if (!role) return [];
  if (role === "ADMIN") return [...AI_DATA_MODULES];
  const mods = enabledModules ?? [];
  return AI_DATA_MODULES.filter((m) => isWorkerModuleEnabled(role, mods, m));
}
