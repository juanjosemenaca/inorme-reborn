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
