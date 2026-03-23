/** Rol en el backoffice Inorme */
export type UserRole = "ADMIN" | "WORKER";

/**
 * Tipo de relación laboral / contrato (alineado con ficha de trabajador)
 */
export type EmploymentType =
  | "FIJO"
  | "TEMPORAL"
  | "AUTONOMO"
  | "PRACTICAS"
  | "SUBCONTRATADO";

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FIJO: "Fijo",
  TEMPORAL: "Temporal",
  AUTONOMO: "Autónomo",
  PRACTICAS: "Prácticas",
  SUBCONTRATADO: "Subcontratado",
};

/**
 * Usuario persistido (simula base de datos en localStorage).
 * La contraseña no debe almacenarse en claro en producción: sustituir por API con hash.
 */
export interface BackofficeUserRecord {
  id: string;
  email: string;
  /** Solo entorno demo; en producción nunca en cliente en claro */
  password: string;
  role: UserRole;
  /**
   * Ficha en Trabajadores de la que salen nombre, DNI, etc.
   * `null` = cuenta legacy o admin sin ficha (p. ej. demo).
   */
  companyWorkerId: string | null;
  firstName: string;
  lastName: string;
  dni: string;
  mobile: string;
  postalAddress: string;
  city: string;
  employmentType: EmploymentType;
  /** Si false, no puede iniciar sesión */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Sesión activa tras login */
export interface BackofficeSession {
  userId: string;
  email: string;
  /** Nombre completo para cabecera */
  name: string;
  role: UserRole;
}

/** @deprecated usar BackofficeUserRecord — mantenido por migración de tipos */
export type BackofficeUserDefinition = Pick<
  BackofficeUserRecord,
  "id" | "email" | "password" | "role"
> & { name: string };

export function getDisplayName(u: Pick<BackofficeUserRecord, "firstName" | "lastName">): string {
  return `${u.firstName} ${u.lastName}`.trim();
}
