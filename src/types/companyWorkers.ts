/**
 * Relación laboral de una persona que trabaja en la compañía (no confundir con usuario del backoffice).
 */
export type CompanyWorkerEmploymentType =
  | "FIJO"
  | "TEMPORAL"
  | "SUBCONTRATADO"
  | "PRACTICAS"
  | "AUTONOMO";

export const COMPANY_WORKER_EMPLOYMENT_LABELS: Record<CompanyWorkerEmploymentType, string> = {
  FIJO: "Fijo",
  TEMPORAL: "Temporal",
  SUBCONTRATADO: "Subcontratado",
  PRACTICAS: "Prácticas",
  AUTONOMO: "Autónomo",
};

/** Si es autónomo: cuenta propia o a través de una empresa (proveedor) */
export type AutonomoVia = "CUENTA_PROPIA" | "EMPRESA";

export const AUTONOMO_VIA_LABELS: Record<AutonomoVia, string> = {
  CUENTA_PROPIA: "Por cuenta propia",
  EMPRESA: "Por empresa (autónomo societario / vinculado a proveedor)",
};

export interface CompanyWorkerRecord {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  mobile: string;
  postalAddress: string;
  /** Ciudad de residencia */
  city: string;
  employmentType: CompanyWorkerEmploymentType;
  /**
   * Proveedor (empresa) cuando es subcontratado o autónomo por empresa.
   * Null si fijo, temporal, prácticas, o autónomo por cuenta propia.
   */
  providerId: string | null;
  /** Solo si `employmentType === "AUTONOMO"` */
  autonomoVia: AutonomoVia | null;
  /** Sede / calendario laboral (festivos y horario de verano). */
  workCalendarSiteId: string;
  /** Días de vacaciones anuales (solo administración). */
  vacationDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function companyWorkerDisplayName(
  w: Pick<CompanyWorkerRecord, "firstName" | "lastName">
): string {
  return `${w.firstName} ${w.lastName}`.trim();
}
