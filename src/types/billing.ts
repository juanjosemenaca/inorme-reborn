export type BillingInvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
export type BillingPaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type BillingInvoiceKind = "NORMAL" | "RECTIFICATIVE";
export type BillingLineType = "BILLABLE" | "BLOCK_TITLE" | "BLOCK_SUBTITLE" | "CONCEPT";

export interface BillingSeriesRecord {
  id: string;
  issuerId: string;
  code: string;
  label: string;
  active: boolean;
}

export interface BillingIssuerRecord {
  id: string;
  code: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  bankAccountIban: string | null;
  bankAccountSwift: string | null;
  bankName: string | null;
  email: string | null;
  phone: string | null;
  logoStoragePath: string | null;
  /** URL pública opcional (factura/PDF). */
  websiteUrl: string | null;
  /** Texto opcional pie PDF (RGPD); no aplica al emisor INORME (texto fijo por CIF en código). */
  privacyFooterText: string | null;
  active: boolean;
}

export interface BillingInvoiceLineRecord {
  id: string;
  invoiceId: string;
  lineOrder: number;
  lineType: BillingLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  /** % de la cantidad (p. ej. horas) que entra en el importe; 100 = íntegro. Solo relevante en BILLABLE. */
  billableHoursPercent: number;
  vatRate: number;
  irpfRate: number;
  taxableBase: number;
  vatAmount: number;
  irpfAmount: number;
  lineTotal: number;
}

export interface BillingInvoiceRecord {
  id: string;
  issuerId: string;
  issuerCode: string;
  seriesId: string;
  seriesCode: string;
  fiscalYear: number | null;
  invoiceNumber: number | null;
  status: BillingInvoiceStatus;
  paymentStatus: BillingPaymentStatus;
  invoiceKind: BillingInvoiceKind;
  rectifiesInvoiceId: string | null;
  issueDate: string | null;
  issuedAt: string | null;
  dueDate: string | null;
  notes: string;
  clientId: string;
  issuerName: string;
  issuerTaxId: string;
  issuerFiscalAddress: string;
  issuerBankAccountIban: string | null;
  issuerBankAccountSwift: string | null;
  issuerBankName: string | null;
  issuerLogoStoragePath: string | null;
  /** Web del emisor en el PDF (snapshot). */
  issuerWebsiteUrl: string | null;
  /** Pie PDF RGPD para emisores distintos de INORME (snapshot); INORME usa texto fijo en generación. */
  issuerPrivacyFooter: string | null;
  /** Email de contacto del emisor (snapshot). */
  issuerEmail: string | null;
  /** Teléfono de contacto del emisor (snapshot). */
  issuerPhone: string | null;
  recipientName: string;
  recipientTaxId: string;
  recipientFiscalAddress: string;
  /** Web del cliente en el PDF (snapshot). */
  recipientWebsiteUrl: string | null;
  /** Destinatario de factura elegido para el PDF (línea; snapshot). */
  recipientAddresseeLine: string | null;
  taxableBaseTotal: number;
  vatTotal: number;
  irpfTotal: number;
  grandTotal: number;
  collectedTotal: number;
  previousHash: string | null;
  recordHash: string | null;
  verifactuQrPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  lines: BillingInvoiceLineRecord[];
}

export interface BillingReceiptRecord {
  id: string;
  invoiceId: string;
  receiptDate: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string;
  createdAt: string;
}

export interface BillingInvoiceDraftInput {
  issuerId: string;
  seriesId: string;
  clientId: string;
  /** Fecha de factura prevista (borrador). */
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string;
  invoiceKind?: BillingInvoiceKind;
  rectifiesInvoiceId?: string | null;
  /** Si se indica, se copian las líneas de esa factura (mismo cliente; no anuladas). */
  copyLinesFromInvoiceId?: string | null;
  /** Rectificativas pueden mantener el emisor aunque esté inactivo en catálogo. */
  allowInactiveIssuer?: boolean;
}

export interface BillingInvoiceLineInput {
  lineType: BillingLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  /** 0.01–100; por defecto 100 (toda la cantidad facturable). */
  billableHoursPercent: number;
  vatRate: 21 | 10 | 4;
  irpfRate: number;
}
