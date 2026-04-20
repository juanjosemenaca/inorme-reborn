/** Grupo Legal — dominio (expedientes, clientes jurídicos, etc.). */

export type LegalClientType = "COMPANY" | "INDIVIDUAL";

export type LegalMatterType =
  | "MERCANTIL"
  | "FISCAL"
  | "LITIGIO"
  | "LABORAL"
  | "CIVIL"
  | "ADMINISTRATIVO"
  | "OTHER";

export type LegalMatterStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export type LegalInvoiceStatus = "DRAFT" | "ISSUED" | "PAID";

export type LegalBillingModel = "HOURLY" | "FIXED" | "MONTHLY_RETAINER";

export type LegalInvoiceLineType = "HOURLY" | "FIXED" | "MONTHLY_RETAINER";

export type LegalCalendarEventType = "HEARING" | "DEADLINE" | "MEETING" | "OTHER";

export interface LegalKeyDateEntry {
  label: string;
  date: string;
}

export interface LegalClientRecord {
  id: string;
  displayName: string;
  taxId: string;
  fiscalAddress: string;
  clientType: LegalClientType;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalContactRecord {
  id: string;
  legalClientId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  position: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalMatterRecord {
  id: string;
  legalClientId: string;
  matterCode: string | null;
  matterType: LegalMatterType;
  status: LegalMatterStatus;
  responsibleLawyerId: string | null;
  title: string;
  description: string;
  openedAt: string | null;
  closedAt: string | null;
  keyDates: LegalKeyDateEntry[];
  createdByBackofficeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalMatterActivityRecord {
  id: string;
  matterId: string;
  activityType: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdByBackofficeUserId: string | null;
  createdAt: string;
}

export interface LegalDocumentRecord {
  id: string;
  matterId: string;
  name: string;
  docType: string;
  version: number;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSize: number | null;
  uploadedByBackofficeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalProcedureRecord {
  id: string;
  matterId: string;
  courtName: string;
  procedureNumber: string;
  proceduralStatus: string;
  keyDates: LegalKeyDateEntry[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalInvoiceRecord {
  id: string;
  matterId: string | null;
  legalClientId: string;
  invoiceNumber: string | null;
  status: LegalInvoiceStatus;
  billingModel: LegalBillingModel;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes: string;
  createdByBackofficeUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: LegalInvoiceLineRecord[];
}

export interface LegalInvoiceLineRecord {
  id: string;
  invoiceId: string;
  lineOrder: number;
  lineType: LegalInvoiceLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegalTimeEntryRecord {
  id: string;
  matterId: string;
  backofficeUserId: string;
  workDate: string;
  hours: number;
  description: string;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalCalendarEventRecord {
  id: string;
  matterId: string | null;
  eventType: LegalCalendarEventType;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  reminderAt: string | null;
  allDay: boolean;
  createdByBackofficeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
