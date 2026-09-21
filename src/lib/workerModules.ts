import {
  isRegistryWorkerModule,
  type UserRole,
  type WorkerModuleKey,
} from "@/types/backoffice";

/** Etiqueta traducida de un módulo, compartida por activación de módulos y «Mi ficha». */
export function workerModuleLabel(
  module: WorkerModuleKey,
  t: (key: string) => string
): string {
  switch (module) {
    case "VACATIONS":
      return t("admin.moduleActivation.mod_vacations");
    case "MESSAGES":
      return t("admin.moduleActivation.mod_messages");
    case "TIME_CLOCK":
      return t("admin.moduleActivation.mod_time_clock");
    case "AGENDA":
      return t("admin.moduleActivation.mod_agenda");
    case "GASTOS":
      return t("admin.moduleActivation.mod_expenses");
    case "FACTURACION":
      return t("admin.moduleActivation.mod_billing");
    case "DMS":
      return t("admin.moduleActivation.mod_dms");
    case "ADMIN_COMPANY_WORKERS":
      return t("admin.moduleActivation.mod_company_workers");
    case "ADMIN_CLIENTS":
      return t("admin.moduleActivation.mod_clients");
    case "ADMIN_PROJECTS":
      return t("admin.moduleActivation.mod_projects");
    case "ADMIN_PROVIDERS":
      return t("admin.moduleActivation.mod_providers");
  }
}

/**
 * Si el módulo está disponible para el usuario, con la misma regla que decide el menú:
 * un ADMIN tiene siempre documental, facturación y maestros; el resto depende de su ficha.
 */
export function isWorkerModuleEnabled(
  role: UserRole | null,
  enabledModules: readonly WorkerModuleKey[],
  module: WorkerModuleKey
): boolean {
  if (role === "ADMIN" && (module === "DMS" || module === "FACTURACION")) return true;
  if (role === "ADMIN" && isRegistryWorkerModule(module)) return true;
  return enabledModules.includes(module);
}
