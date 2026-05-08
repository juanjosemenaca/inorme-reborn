import type { BillingInvoiceRecord } from "@/types/billing";

/** Tolerancia € para comparar total cobrado vs total factura. */
export const BILLING_COLLECTION_EPS = 0.005;

/** Semáforo de cobro según `grandTotal` y `collectedTotal` (facturas anuladas: no aplica). */
export type BillingCollectionSemaphore = "full" | "partial" | "none" | "na";

export function billingCollectionSemaphore(inv: BillingInvoiceRecord): BillingCollectionSemaphore {
  if (inv.status === "CANCELLED") return "na";
  const gt = Number(inv.grandTotal) || 0;
  const col = Number(inv.collectedTotal) || 0;
  const due = gt - col;
  if (due <= BILLING_COLLECTION_EPS) return "full";
  if (col <= BILLING_COLLECTION_EPS) return "none";
  return "partial";
}

export function billingInvoiceOutstandingAmount(inv: BillingInvoiceRecord): number {
  if (inv.status === "CANCELLED" || inv.status === "DRAFT") return 0;
  const gt = Number(inv.grandTotal) || 0;
  const col = Number(inv.collectedTotal) || 0;
  return Math.max(0, Math.round((gt - col) * 100) / 100);
}

export function billingInvoiceHasCollectionOutstanding(inv: BillingInvoiceRecord): boolean {
  if (inv.status === "CANCELLED") return false;
  return billingInvoiceOutstandingAmount(inv) > BILLING_COLLECTION_EPS;
}
