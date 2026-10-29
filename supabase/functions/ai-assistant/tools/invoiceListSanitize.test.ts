import { describe, expect, it } from "vitest";
import { sanitizeInvoiceListInput } from "./invoiceListSanitize.ts";

describe("sanitizeInvoiceListInput", () => {
  it("quita ceros de cantidad que el modelo pone por defecto", () => {
    const out = sanitizeInvoiceListInput({
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      min_amount: 1,
      min_quantity: 0,
      max_quantity: 0,
      payment: "",
      client_query: "",
    }) as Record<string, unknown>;
    expect(out.min_quantity).toBeUndefined();
    expect(out.max_quantity).toBeUndefined();
    expect(out.payment).toBeUndefined();
    expect(out.client_query).toBeUndefined();
    expect(out.min_amount).toBe(1);
  });

  it("ignora max_amount 0 si hay un mínimo", () => {
    const out = sanitizeInvoiceListInput({ min_amount: 1000, max_amount: 0 }) as Record<string, unknown>;
    expect(out.min_amount).toBe(1000);
    expect(out.max_amount).toBeUndefined();
  });

  it("conserva un rango de cantidad pedido de verdad", () => {
    const out = sanitizeInvoiceListInput({ min_quantity: 2, max_quantity: 10 }) as Record<string, unknown>;
    expect(out.min_quantity).toBe(2);
    expect(out.max_quantity).toBe(10);
  });
});
