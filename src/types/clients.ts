/** Cliente final (consumidor) o intermediario (distribuidor, integrador, etc.) */
export type ClientKind = "FINAL" | "INTERMEDIARIO";

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  FINAL: "Cliente final",
  INTERMEDIARIO: "Cliente intermediario",
};

/** Contacto habitual vs persona a la que van dirigidas las facturas (solo clientes). */
export type ClientContactPurpose = "GENERAL" | "INVOICE";

/** Persona de contacto vinculada a un cliente */
export interface ClientContactPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  /** Cargo / posición en la empresa */
  position: string;
  /** Descripción del rol o notas sobre la persona */
  description: string;
  /** GENERAL: interlocutor; INVOICE: destinatario de facturación. */
  contactPurpose: ClientContactPurpose;
}

/** Cliente corporativo persistido (demo en localStorage) */
export interface ClientRecord {
  id: string;
  /** Nombre comercial */
  tradeName: string;
  /** Razón social / nombre de empresa */
  companyName: string;
  cif: string;
  /** Dirección principal / operativa */
  postalAddress: string;
  /** Dirección fiscal completa */
  fiscalAddress: string;
  clientKind: ClientKind;
  /**
   * Solo si `clientKind === "INTERMEDIARIO"`: id del cliente final asociado (si se conoce).
   * Debe referenciar a otro registro con tipo «cliente final».
   */
  linkedFinalClientId: string | null;
  /** Teléfono principal de la empresa */
  phone: string;
  /** Email de contacto general de la empresa */
  contactEmail: string;
  /** Sitio web público (opcional), p. ej. https://empresa.com */
  websiteUrl: string;
  /** Notas internas opcionales */
  notes: string;
  /** Destinatarios de facturación (texto libre; varios separados por `;`). */
  invoiceAddresseeLine: string;
  active: boolean;
  contacts: ClientContactPerson[];
  createdAt: string;
  updatedAt: string;
}

export function contactDisplayName(c: Pick<ClientContactPerson, "firstName" | "lastName">): string {
  return `${c.firstName} ${c.lastName}`.trim();
}
