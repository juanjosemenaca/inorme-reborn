import type { BillingInvoiceRecord } from "@/types/billing";

export type BillingInvoiceMonthBucket = {
  key: string;
  year: number;
  month: number;
  items: BillingInvoiceRecord[];
};

export type BillingInvoiceIssuerBucket = {
  issuerId: string;
  issuerCode: string;
  monthBuckets: BillingInvoiceMonthBucket[];
};

function parseYmd(raw: string | null | undefined): { y: number; m: number } | null {
  if (!raw?.trim()) return null;
  const d = raw.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

function fromIsoInstant(iso: string): { y: number; m: number } {
  const t = Date.parse(iso);
  const d = Number.isNaN(t) ? new Date() : new Date(t);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

/** Borradores: mes/año por fecha de creación. */
export function draftGroupYearMonth(inv: BillingInvoiceRecord): { y: number; m: number } {
  return fromIsoInstant(inv.createdAt);
}

/** Emitidas: mes/año por fecha de factura; respaldo issuedAt / ejercicio. */
export function issuedGroupYearMonth(inv: BillingInvoiceRecord): { y: number; m: number } {
  const fromIssue = parseYmd(inv.issueDate);
  if (fromIssue) return fromIssue;
  const fromIssued = parseYmd(inv.issuedAt);
  if (fromIssued) return fromIssued;
  if (inv.fiscalYear != null) return { y: inv.fiscalYear, m: 12 };
  return fromIsoInstant(inv.createdAt);
}

function sortInvoicesInBucket(a: BillingInvoiceRecord, b: BillingInvoiceRecord): number {
  const da = a.issueDate ?? a.issuedAt?.slice(0, 10) ?? a.updatedAt.slice(0, 10);
  const db = b.issueDate ?? b.issuedAt?.slice(0, 10) ?? b.updatedAt.slice(0, 10);
  const c = db.localeCompare(da);
  if (c !== 0) return c;
  const na = a.invoiceNumber ?? 0;
  const nb = b.invoiceNumber ?? 0;
  if (nb !== na) return nb - na;
  return b.id.localeCompare(a.id);
}

/**
 * Agrupa facturas por emisor y luego por año-mes (orden emisores según `issuerOrder`, meses de más reciente a más antiguo).
 */
export function groupInvoicesByIssuerAndMonth(
  items: BillingInvoiceRecord[],
  getYearMonth: (inv: BillingInvoiceRecord) => { y: number; m: number },
  issuerOrder: { id: string; code: string }[]
): BillingInvoiceIssuerBucket[] {
  const byIssuer = new Map<string, Map<string, BillingInvoiceRecord[]>>();
  for (const inv of items) {
    const { y, m } = getYearMonth(inv);
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    if (!byIssuer.has(inv.issuerId)) byIssuer.set(inv.issuerId, new Map());
    const months = byIssuer.get(inv.issuerId)!;
    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey)!.push(inv);
  }

  const issuerRank = new Map(issuerOrder.map((x, i) => [x.id, i]));

  const buckets: BillingInvoiceIssuerBucket[] = [];
  for (const [issuerId, months] of byIssuer) {
    const monthBuckets: BillingInvoiceMonthBucket[] = [];
    const sortedMonthKeys = [...months.keys()].sort((a, b) => b.localeCompare(a));
    for (const key of sortedMonthKeys) {
      const arr = months.get(key)!;
      arr.sort(sortInvoicesInBucket);
      const [ys, ms] = key.split("-");
      monthBuckets.push({
        key,
        year: Number(ys),
        month: Number(ms),
        items: arr,
      });
    }
    const first = monthBuckets[0]?.items[0];
    buckets.push({
      issuerId,
      issuerCode: first?.issuerCode ?? issuerOrder.find((x) => x.id === issuerId)?.code ?? "—",
      monthBuckets,
    });
  }

  buckets.sort((a, b) => {
    const ra = issuerRank.get(a.issuerId) ?? 999;
    const rb = issuerRank.get(b.issuerId) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.issuerCode.localeCompare(b.issuerCode, undefined, { sensitivity: "base" });
  });

  return buckets;
}

export function formatInvoiceMonthHeading(locale: string, year: number, month: number, unknownLabel: string): string {
  if (!year || !month) return unknownLabel;
  const d = new Date(year, month - 1, 1);
  const s = d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
