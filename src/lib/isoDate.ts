/**
 * Fechas `date` de Postgres / PostgREST pueden llegar como `YYYY-MM-DD` o como ISO con hora.
 * Los `<input type="date">` solo aceptan `YYYY-MM-DD`.
 */

/** Extrae `YYYY-MM-DD` de una cadena ISO o devuelve el trim (para mapeo seguro desde BD). */
export function isoDateOnlyFromDb(value: string): string {
  const t = value.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1]! : t;
}

export type ParsedIsoDateYmd = { iso: string; year: number };

/** Valida y devuelve fecha en `YYYY-MM-DD` y año (2000–2100). Lanza si no es válida. */
export function parseIsoDateYmdCalendar(value: string): ParsedIsoDateYmd {
  const iso = isoDateOnlyFromDb(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error("La fecha no tiene un formato válido (YYYY-MM-DD).");
  }
  const y = parseInt(iso.slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw new Error("El año de la fecha debe estar entre 2000 y 2100.");
  }
  return { iso, year: y };
}
