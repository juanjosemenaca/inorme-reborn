import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  BillingInvoiceLineRow,
  BillingInvoiceRow,
  BillingReceiptRow,
  BillingSeriesRow,
  ClientRow,
} from "@/types/database";
import type {
  BillingIssuerProfileRecord,
  BillingInvoiceDraftInput,
  BillingInvoiceLineInput,
  BillingInvoiceLineRecord,
  BillingInvoiceRecord,
  BillingReceiptRecord,
  BillingSeriesRecord,
} from "@/types/billing";

function throwErr(e: unknown): never {
  throw new Error(getErrorMessage(e));
}

function parseMoney(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? 0));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

type Profile = {
  id: string;
  role: "ADMIN" | "WORKER";
};

async function requireProfile(): Promise<Profile> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) throw new Error("No se pudo resolver el perfil.");
  return { id: profile.id, role: profile.role };
}

async function appendAudit(
  entityType: string,
  entityId: string,
  eventType: string,
  payload: Record<string, unknown>,
  actorBackofficeUserId: string
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("billing_audit_logs").insert({
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    event_payload: payload,
    actor_backoffice_user_id: actorBackofficeUserId,
  });
  if (error) throwErr(error);
}

function lineRowToDomain(row: BillingInvoiceLineRow): BillingInvoiceLineRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    lineOrder: row.line_order,
    lineType: row.line_type ?? "BILLABLE",
    description: row.description,
    quantity: parseMoney(row.quantity),
    unitPrice: parseMoney(row.unit_price),
    vatRate: parseMoney(row.vat_rate),
    irpfRate: parseMoney(row.irpf_rate),
    taxableBase: parseMoney(row.taxable_base),
    vatAmount: parseMoney(row.vat_amount),
    irpfAmount: parseMoney(row.irpf_amount),
    lineTotal: parseMoney(row.line_total),
  };
}

function invoiceRowToDomain(
  row: BillingInvoiceRow,
  seriesCode: string,
  lines: BillingInvoiceLineRow[]
): BillingInvoiceRecord {
  return {
    id: row.id,
    seriesId: row.series_id,
    seriesCode,
    fiscalYear: row.fiscal_year,
    invoiceNumber: row.invoice_number,
    status: row.status,
    paymentStatus: row.payment_status,
    invoiceKind: row.invoice_kind,
    rectifiesInvoiceId: row.rectifies_invoice_id,
    issueDate: row.issue_date,
    issuedAt: row.issued_at,
    dueDate: row.due_date,
    notes: row.notes,
    clientId: row.client_id,
    issuerName: row.issuer_name,
    issuerTaxId: row.issuer_tax_id,
    issuerFiscalAddress: row.issuer_fiscal_address,
    issuerBankAccountIban: row.issuer_bank_account_iban,
    issuerBankAccountSwift: row.issuer_bank_account_swift,
    issuerBankName: row.issuer_bank_name,
    recipientName: row.recipient_name,
    recipientTaxId: row.recipient_tax_id,
    recipientFiscalAddress: row.recipient_fiscal_address,
    taxableBaseTotal: parseMoney(row.taxable_base_total),
    vatTotal: parseMoney(row.vat_total),
    irpfTotal: parseMoney(row.irpf_total),
    grandTotal: parseMoney(row.grand_total),
    collectedTotal: parseMoney(row.collected_total),
    previousHash: row.previous_hash,
    recordHash: row.record_hash,
    verifactuQrPayload: row.verifactu_qr_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines: lines.map(lineRowToDomain),
  };
}

export async function fetchBillingSeries(): Promise<BillingSeriesRecord[]> {
  await requireProfile();
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_series").select("*").order("code", { ascending: true });
  if (error) throwErr(error);
  return ((data ?? []) as BillingSeriesRow[]).map((s) => ({
    id: s.id,
    code: s.code,
    label: s.label,
    active: s.active,
  }));
}

export async function fetchBillingIssuerProfile(): Promise<BillingIssuerProfileRecord | null> {
  await requireProfile();
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_issuer_profile").select("*").maybeSingle();
  if (error) throwErr(error);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    legalName: String(row.legal_name ?? ""),
    taxId: String(row.tax_id ?? ""),
    fiscalAddress: String(row.fiscal_address ?? ""),
    bankAccountIban: row.bank_account_iban ? String(row.bank_account_iban) : null,
    bankAccountSwift: row.bank_account_swift ? String(row.bank_account_swift) : null,
    bankName: row.bank_name ? String(row.bank_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

export async function upsertBillingIssuerProfile(input: {
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  bankAccountIban?: string | null;
  bankAccountSwift?: string | null;
  bankName?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<BillingIssuerProfileRecord> {
  await requireProfile();
  const legalName = input.legalName.trim();
  const taxId = input.taxId.trim().toUpperCase();
  const fiscalAddress = input.fiscalAddress.trim();
  if (!legalName) throw new Error("Indica la razón social del emisor.");
  if (!taxId) throw new Error("Indica el NIF/CIF del emisor.");
  if (!fiscalAddress) throw new Error("Indica la dirección fiscal del emisor.");

  const sb = requireSupabase();
  const { data: current, error: currentErr } = await sb.from("billing_issuer_profile").select("*").maybeSingle();
  if (currentErr) throwErr(currentErr);
  const payload = {
    legal_name: legalName,
    tax_id: taxId,
    fiscal_address: fiscalAddress,
    bank_account_iban: input.bankAccountIban?.trim() || null,
    bank_account_swift: input.bankAccountSwift?.trim().toUpperCase() || null,
    bank_name: input.bankName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  };

  if (current) {
    const { data, error } = await sb
      .from("billing_issuer_profile")
      .update(payload)
      .eq("id", (current as Record<string, unknown>).id)
      .select("*")
      .single();
    if (error) throwErr(error);
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      legalName: String(row.legal_name ?? ""),
      taxId: String(row.tax_id ?? ""),
      fiscalAddress: String(row.fiscal_address ?? ""),
      bankAccountIban: row.bank_account_iban ? String(row.bank_account_iban) : null,
      bankAccountSwift: row.bank_account_swift ? String(row.bank_account_swift) : null,
      bankName: row.bank_name ? String(row.bank_name) : null,
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
    };
  }

  const { data, error } = await sb.from("billing_issuer_profile").insert(payload).select("*").single();
  if (error) throwErr(error);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    legalName: String(row.legal_name ?? ""),
    taxId: String(row.tax_id ?? ""),
    fiscalAddress: String(row.fiscal_address ?? ""),
    bankAccountIban: row.bank_account_iban ? String(row.bank_account_iban) : null,
    bankAccountSwift: row.bank_account_swift ? String(row.bank_account_swift) : null,
    bankName: row.bank_name ? String(row.bank_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

export async function createBillingSeries(input: { code: string; label: string }): Promise<BillingSeriesRecord> {
  await requireProfile();
  const code = input.code.trim().toUpperCase();
  const label = input.label.trim();
  if (!code) throw new Error("Indica el código de la serie.");
  if (!label) throw new Error("Indica el nombre de la serie.");

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("billing_series")
    .upsert({ code, label, active: true }, { onConflict: "code" })
    .select("*")
    .single();
  if (error) throwErr(error);
  const row = data as BillingSeriesRow;
  return { id: row.id, code: row.code, label: row.label, active: row.active };
}

export async function setBillingSeriesActive(seriesId: string, active: boolean): Promise<void> {
  await requireProfile();
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_series")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", seriesId);
  if (error) throwErr(error);
}

export async function fetchBillingInvoices(): Promise<BillingInvoiceRecord[]> {
  await requireProfile();
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("billing_invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  if (!rows?.length) return [];

  const invoiceIds = rows.map((r) => (r as BillingInvoiceRow).id);
  const { data: lineRows, error: lineErr } = await sb
    .from("billing_invoice_lines")
    .select("*")
    .in("invoice_id", invoiceIds)
    .order("line_order", { ascending: true });
  if (lineErr) throwErr(lineErr);

  const { data: seriesRows, error: seriesErr } = await sb.from("billing_series").select("*");
  if (seriesErr) throwErr(seriesErr);
  const seriesById = new Map((seriesRows ?? []).map((s) => [(s as BillingSeriesRow).id, s as BillingSeriesRow]));

  const byInvoice = new Map<string, BillingInvoiceLineRow[]>();
  for (const id of invoiceIds) byInvoice.set(id, []);
  for (const ln of (lineRows ?? []) as BillingInvoiceLineRow[]) byInvoice.get(ln.invoice_id)?.push(ln);

  return (rows as BillingInvoiceRow[]).map((inv) =>
    invoiceRowToDomain(inv, seriesById.get(inv.series_id)?.code ?? "?", byInvoice.get(inv.id) ?? [])
  );
}

async function resolveIssuerSnapshot(): Promise<{
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  bankAccountIban: string | null;
  bankAccountSwift: string | null;
  bankName: string | null;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_issuer_profile").select("*").maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Falta configurar datos fiscales del emisor en billing_issuer_profile.");
  const row = data as Record<string, unknown>;
  return {
    legalName: String(row.legal_name ?? ""),
    taxId: String(row.tax_id ?? ""),
    fiscalAddress: String(row.fiscal_address ?? ""),
    bankAccountIban: row.bank_account_iban ? String(row.bank_account_iban) : null,
    bankAccountSwift: row.bank_account_swift ? String(row.bank_account_swift) : null,
    bankName: row.bank_name ? String(row.bank_name) : null,
  };
}

async function resolveClientSnapshot(clientId: string): Promise<{ name: string; taxId: string; fiscalAddress: string }> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Cliente no encontrado.");
  const client = data as ClientRow;
  const name = (client.company_name || client.trade_name || "").trim();
  const fiscalAddress = (client.fiscal_address || client.postal_address || "").trim();
  return {
    name,
    taxId: (client.cif || "").trim(),
    fiscalAddress,
  };
}

export async function createBillingInvoiceDraft(input: BillingInvoiceDraftInput): Promise<BillingInvoiceRecord> {
  const profile = await requireProfile();
  const issuer = await resolveIssuerSnapshot();
  const recipient = await resolveClientSnapshot(input.clientId);
  if (!recipient.name) throw new Error("El cliente no tiene nombre comercial o razón social informada.");
  if (!recipient.taxId) throw new Error("El cliente no tiene NIF/CIF informado.");
  if (!recipient.fiscalAddress) throw new Error("El cliente no tiene dirección fiscal informada.");

  const sb = requireSupabase();
  const { data: row, error } = await sb
    .from("billing_invoices")
    .insert({
      series_id: input.seriesId,
      status: "DRAFT",
      payment_status: "PENDING",
      invoice_kind: input.invoiceKind ?? "NORMAL",
      rectifies_invoice_id: input.rectifiesInvoiceId ?? null,
      due_date: input.dueDate ?? null,
      notes: input.notes?.trim() ?? "",
      client_id: input.clientId,
      issuer_name: issuer.legalName,
      issuer_tax_id: issuer.taxId,
      issuer_fiscal_address: issuer.fiscalAddress,
      issuer_bank_account_iban: issuer.bankAccountIban,
      issuer_bank_account_swift: issuer.bankAccountSwift,
      issuer_bank_name: issuer.bankName,
      recipient_name: recipient.name,
      recipient_tax_id: recipient.taxId,
      recipient_fiscal_address: recipient.fiscalAddress,
      created_by_backoffice_user_id: profile.id,
      updated_by_backoffice_user_id: profile.id,
    })
    .select("*")
    .single();
  if (error) throwErr(error);

  await appendAudit("INVOICE", (row as BillingInvoiceRow).id, "DRAFT_CREATED", { clientId: input.clientId }, profile.id);

  const seriesRows = await fetchBillingSeries();
  const series = seriesRows.find((s) => s.id === (row as BillingInvoiceRow).series_id);
  return invoiceRowToDomain(row as BillingInvoiceRow, series?.code ?? "?", []);
}

export async function createRectificativeDraftFromInvoice(originalInvoiceId: string, seriesId: string): Promise<BillingInvoiceRecord> {
  const all = await fetchBillingInvoices();
  const source = all.find((i) => i.id === originalInvoiceId);
  if (!source) throw new Error("Factura origen no encontrada.");
  return createBillingInvoiceDraft({
    seriesId,
    clientId: source.clientId,
    invoiceKind: "RECTIFICATIVE",
    rectifiesInvoiceId: source.id,
    dueDate: source.dueDate,
    notes: `Rectificativa de ${source.seriesCode}-${source.fiscalYear ?? "----"}/${source.invoiceNumber ?? ""}`.trim(),
  });
}

export async function updateBillingInvoiceDraftHeader(
  invoiceId: string,
  patch: { dueDate?: string | null; notes?: string }
): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Factura no encontrada.");
  if ((data as BillingInvoiceRow).status !== "DRAFT") throw new Error("Solo se puede editar cabecera en borrador.");
  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({
      due_date: patch.dueDate ?? (data as BillingInvoiceRow).due_date,
      notes: patch.notes !== undefined ? patch.notes.trim() : (data as BillingInvoiceRow).notes,
      updated_by_backoffice_user_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (upErr) throwErr(upErr);
  await appendAudit("INVOICE", invoiceId, "DRAFT_UPDATED", patch as Record<string, unknown>, profile.id);
}

export async function replaceBillingInvoiceLines(invoiceId: string, lines: BillingInvoiceLineInput[]): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data: invoice, error: invErr } = await sb.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (invErr) throwErr(invErr);
  if (!invoice) throw new Error("Factura no encontrada.");
  if ((invoice as BillingInvoiceRow).status !== "DRAFT") throw new Error("Solo puedes editar líneas en borrador.");

  const { error: delErr } = await sb.from("billing_invoice_lines").delete().eq("invoice_id", invoiceId);
  if (delErr) throwErr(delErr);
  if (lines.length > 0) {
    const payload = lines.map((line, idx) => ({
      line_type: line.lineType,
      invoice_id: invoiceId,
      line_order: idx + 1,
      description: line.description.trim(),
      quantity: line.lineType === "BILLABLE" ? line.quantity : 0,
      unit_price: line.lineType === "BILLABLE" ? line.unitPrice : 0,
      vat_rate: line.vatRate,
      irpf_rate: line.lineType === "BILLABLE" ? line.irpfRate : 0,
    }));
    const { error: insErr } = await sb.from("billing_invoice_lines").insert(payload);
    if (insErr) throwErr(insErr);
  }
  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({ updated_by_backoffice_user_id: profile.id, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (upErr) throwErr(upErr);

  await appendAudit("INVOICE", invoiceId, "LINES_REPLACED", { count: lines.length }, profile.id);
}

export async function emitBillingInvoice(invoiceId: string, issueDate?: string): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { error } = await sb.rpc("billing_emit_invoice", {
    p_invoice_id: invoiceId,
    p_actor_backoffice_user_id: profile.id,
    p_issue_date: issueDate ?? null,
  });
  if (error) throwErr(error);
}

export async function cancelBillingInvoice(invoiceId: string, reason: string): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const r = reason.trim();
  if (!r) throw new Error("Indica el motivo de la anulación.");
  const { data, error } = await sb.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Factura no encontrada.");
  const row = data as BillingInvoiceRow;
  if (row.status === "DRAFT") throw new Error("No se anula un borrador; simplemente no se emite.");
  if (row.status === "CANCELLED") return;

  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({
      status: "CANCELLED",
      notes: `${row.notes}\n[ANULADA] ${r}`.trim(),
      updated_by_backoffice_user_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (upErr) throwErr(upErr);

  await appendAudit("INVOICE", invoiceId, "CANCELLED", { reason: r }, profile.id);
}

/**
 * Solo para periodo de pruebas: borrado físico de factura y cobros asociados.
 * El trigger en BD lo permite/bloquea según billing_runtime_settings.allow_invoice_delete_in_test.
 */
export async function deleteBillingInvoiceForTests(invoiceId: string): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data: inv, error: invErr } = await sb.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (invErr) throwErr(invErr);
  if (!inv) throw new Error("Factura no encontrada.");

  await appendAudit("INVOICE", invoiceId, "DELETE_TEST_MODE_REQUESTED", { status: (inv as BillingInvoiceRow).status }, profile.id);

  const { error: recErr } = await sb.from("billing_receipts").delete().eq("invoice_id", invoiceId);
  if (recErr) throwErr(recErr);

  const { error: delErr } = await sb.from("billing_invoices").delete().eq("id", invoiceId);
  if (delErr) throwErr(delErr);
}

export async function registerBillingReceipt(input: {
  invoiceId: string;
  receiptDate: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
}): Promise<BillingReceiptRecord> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  if (input.amount <= 0) throw new Error("El importe del cobro debe ser mayor que cero.");
  const { data: inv, error: invErr } = await sb.from("billing_invoices").select("*").eq("id", input.invoiceId).maybeSingle();
  if (invErr) throwErr(invErr);
  if (!inv) throw new Error("Factura no encontrada.");
  const invoice = inv as BillingInvoiceRow;
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    throw new Error("Solo se pueden registrar cobros en facturas emitidas.");
  }

  const { data: inserted, error } = await sb
    .from("billing_receipts")
    .insert({
      invoice_id: input.invoiceId,
      receipt_date: input.receiptDate,
      amount: input.amount,
      method: input.method.trim() || "BANK_TRANSFER",
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || "",
      created_by_backoffice_user_id: profile.id,
    })
    .select("*")
    .single();
  if (error) throwErr(error);

  const { data: receipts, error: recErr } = await sb
    .from("billing_receipts")
    .select("*")
    .eq("invoice_id", input.invoiceId);
  if (recErr) throwErr(recErr);
  const collected = Math.round(((receipts ?? []) as BillingReceiptRow[]).reduce((acc, r) => acc + parseMoney(r.amount), 0) * 100) / 100;
  const total = parseMoney(invoice.grand_total);
  const paymentStatus = collected <= 0 ? "PENDING" : collected < total ? "PARTIAL" : "PAID";
  const invoiceStatus = paymentStatus === "PAID" ? "PAID" : "ISSUED";

  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({
      collected_total: collected,
      payment_status: paymentStatus,
      status: invoiceStatus,
      updated_by_backoffice_user_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.invoiceId);
  if (upErr) throwErr(upErr);

  await appendAudit("INVOICE", input.invoiceId, "RECEIPT_REGISTERED", { amount: input.amount, collectedTotal: collected }, profile.id);

  const row = inserted as BillingReceiptRow;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    receiptDate: row.receipt_date,
    amount: parseMoney(row.amount),
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
  };
}
