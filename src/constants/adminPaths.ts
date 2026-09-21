/**
 * Segmentos de ruta bajo `/admin` (coinciden con `<Route path="…">` en App.tsx).
 */
export const ADMIN_ROUTE_SEG = {
  solicitudesFicha: "solicitudes-ficha",
  solicitudesFichajes: "solicitudes-fichajes",
  solicitudesVacaciones: "solicitudes-vacaciones",
  mensajesTrabajadores: "mensajes-trabajadores",
  gastosTrabajadores: "gastos-trabajadores",
} as const;

const adminAbs = (seg: string) => `/admin/${seg}`;

/** Rutas absolutas del backoffice (enlaces, NAV_KEYS, etc.). */
export const ADMIN_PATHS = {
  root: "/admin",
  solicitudesFicha: adminAbs(ADMIN_ROUTE_SEG.solicitudesFicha),
  solicitudesFichajes: adminAbs(ADMIN_ROUTE_SEG.solicitudesFichajes),
  solicitudesVacaciones: adminAbs(ADMIN_ROUTE_SEG.solicitudesVacaciones),
  mensajesTrabajadores: adminAbs(ADMIN_ROUTE_SEG.mensajesTrabajadores),
  gastosTrabajadores: adminAbs(ADMIN_ROUTE_SEG.gastosTrabajadores),
} as const;

export const SOLICITUDES_GROUP = {
  PERSONAL: "PERSONAL",
  CALENDAR: "CALENDAR",
  VACATIONS: "VACATIONS",
  MODULES: "MODULES",
  TIME_CLOCK: "TIME_CLOCK",
} as const;

export type SolicitudesGroup = (typeof SOLICITUDES_GROUP)[keyof typeof SOLICITUDES_GROUP];

export const SOLICITUDES_GROUP_HASH: Record<SolicitudesGroup, `#${string}`> = {
  PERSONAL: "#datos",
  CALENDAR: "#calendario",
  VACATIONS: "#vacaciones",
  MODULES: "#modulos",
  TIME_CLOCK: "#fichajes",
};

export function solicitudesGroupHref(group: SolicitudesGroup): string {
  return `${ADMIN_PATHS.solicitudesFicha}${SOLICITUDES_GROUP_HASH[group]}`;
}

export function solicitudesGroupFromHash(hash: string): SolicitudesGroup | null {
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  for (const [group, groupHash] of Object.entries(SOLICITUDES_GROUP_HASH) as [
    SolicitudesGroup,
    string,
  ][]) {
    if (groupHash === normalized) return group;
  }
  return null;
}
