/**
 * El modelo a menudo rellena filtros no pedidos con "" o 0.
 * Eso vaciaría el listado (p. ej. min_quantity=0 y max_quantity=0).
 */
export function sanitizeInvoiceListInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  for (const k of ["payment", "order_by", "order", "client_query"]) {
    if (o[k] === "" || o[k] === null) delete o[k];
  }

  for (const k of ["min_amount", "max_amount", "min_quantity", "max_quantity", "limit"]) {
    if (o[k] === "" || o[k] === null) delete o[k];
  }

  const n = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const x = Number(v);
      return Number.isFinite(x) ? x : null;
    }
    return null;
  };

  const minQ = n(o.min_quantity);
  const maxQ = n(o.max_quantity);
  if (minQ === 0 && maxQ === 0) {
    delete o.min_quantity;
    delete o.max_quantity;
  }

  const minA = n(o.min_amount);
  const maxA = n(o.max_amount);
  if (maxA === 0 && (minA == null || minA > 0)) delete o.max_amount;
  if (minA === 0 && maxA == null) delete o.min_amount;

  return o;
}
