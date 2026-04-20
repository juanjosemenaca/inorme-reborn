/** Producto / instancia de backoffice compilada en el bundle (Vite). */
export type BackofficeProductId = "INORME" | "ATTIS";

/**
 * Selecciona la variante de marca y copy del backoffice.
 * Para «Back Office Attis» con datos y usuarios propios: despliega otra build con
 * `VITE_BACKOFFICE_PRODUCT=ATTIS` y credenciales de **otro** proyecto Supabase.
 */
export function getBackofficeProduct(): BackofficeProductId {
  const raw = import.meta.env.VITE_BACKOFFICE_PRODUCT?.trim().toUpperCase() ?? "";
  if (raw === "ATTIS") return "ATTIS";
  return "INORME";
}

export function isAttisBackoffice(): boolean {
  return getBackofficeProduct() === "ATTIS";
}

/** Clave i18n `admin.layout*` vs `admin.layout_attis*`. */
export function backofficeLayoutKey(suffix: string): string {
  return isAttisBackoffice() ? `admin.layout_attis.${suffix}` : `admin.layout.${suffix}`;
}

/** Título y subtítulo del login (resto de claves siguen en `admin.login.*`). */
export function backofficeLoginTitleKey(): string {
  return isAttisBackoffice() ? "admin.login_attis.title" : "admin.login.title";
}

export function backofficeLoginSubtitleKey(): string {
  return isAttisBackoffice() ? "admin.login_attis.subtitle" : "admin.login.subtitle";
}

export function backofficeWorkerShellTitleKey(): string {
  return isAttisBackoffice() ? "admin.common.backoffice_attis" : "admin.common.backoffice";
}
