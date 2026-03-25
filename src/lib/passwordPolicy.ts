/** Duración de la política de renovación (días). */
export const PASSWORD_MAX_AGE_DAYS = 365;

/**
 * Genera una contraseña temporal segura para el primer acceso (solo se muestra una vez al administrador).
 */
export function generateInitialPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&";
  const buf = new Uint8Array(18);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}

/**
 * Hay que forzar pantalla de cambio: primer acceso, admin lo marcó, o pasó el plazo anual.
 */
export function profileRequiresPasswordChange(
  mustChangePassword: boolean | null | undefined,
  passwordChangedAt: string | null | undefined
): boolean {
  if (mustChangePassword === true) return true;
  if (passwordChangedAt == null || passwordChangedAt === "") return true;
  const last = new Date(passwordChangedAt).getTime();
  if (Number.isNaN(last)) return true;
  const maxMs = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - last > maxMs;
}

/** Fecha límite recomendada para el próximo cambio (solo informativo en UI). */
export function nextPasswordRenewalDeadline(passwordChangedAt: string | null): Date | null {
  if (!passwordChangedAt) return null;
  const last = new Date(passwordChangedAt);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
}
