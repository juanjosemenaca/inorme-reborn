export type BillingInvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
export type BillingPaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type BillingInvoiceKind = "NORMAL" | "RECTIFICATIVE";
export type BillingLineType = "BILLABLE" | "BLOCK_TITLE" | "BLOCK_SUBTITLE" | "CONCEPT";

export interface BillingSeriesRecord {
  id: string;
  code: string;
  label: string;
  active: boolean;
}

export interface BillingIssuerProfileRecord {
  id: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  bankAccountIban: string | null;
  bankAccountSwift: string | null;
  bankName: string | null;
  email: string | null;
  phone: string | null;
}

export interface BillingInvoiceLineRecord {
  id: string;
  invoiceId: string;
  lineOrder: number;
  lineType: BillingLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  irpfRate: number;
  taxableBase: number;
  vatAmount: number;
  irpfAmount: number;
  lineTotal: number;
}

export interface BillingInvoiceRecord {
  id: string;
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
  recipientName: string;
  recipientTaxId: string;
  recipientFiscalAddress: string;
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
  seriesId: string;
  clientId: string;
  dueDate?: string | null;
  notes?: string;
  invoiceKind?: BillingInvoiceKind;
  rectifiesInvoiceId?: string | null;
}

export interface BillingInvoiceLineInput {
  lineType: BillingLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: 21 | 10 | 4;
  irpfRate: number;
}
