import type { ClientContactPerson } from "@/types/clients";

/**
 * Proveedor: mismos datos de alta que un cliente (fiscal, contacto, personas de contacto),
 * sin distinción cliente final / intermediario.
 */
export interface ProviderRecord {
  id: string;
  tradeName: string;
  companyName: string;
  cif: string;
  fiscalAddress: string;
  phone: string;
  contactEmail: string;
  notes: string;
  active: boolean;
  contacts: ClientContactPerson[];
  createdAt: string;
  updatedAt: string;
}
