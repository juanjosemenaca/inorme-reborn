import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { PROJECT_DOCUMENTS_BUCKET } from "@/api/projectsApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import { isInormeInformaticaOrganizacionIssuer } from "@/lib/billingPrivacyFooter";
import type {
  BillingInvoiceLineRow,
  BillingInvoiceRow,
  BillingIssuerRow,
  BillingReceiptRow,
  BillingSeriesRow,
  ClientRow,
} from "@/types/database";
import type {
  BillingIssuerRecord,
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

/** Valor de `issuer_privacy_footer` en borrador: null para INORME (PDF fijo por CIF); texto opcional para otros. */
function issuerPrivacyFooterForDraftSnapshot(snap: { taxId: string; privacyFooterText: string | null }): string | null {
  if (isInormeInformaticaOrganizacionIssuer(snap.taxId)) return null;
  const t = snap.privacyFooterText?.trim();
  return t || null;
}

function parseMoney(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? 0));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** 0.01–100; encaja con ck_billing_line_billable_hours_percent. */
function clampBillableHoursPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 100;
  if (raw <= 0) return 0.01;
  if (raw > 100) return 100;
  return Math.round(raw * 10000) / 10000;
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
  const pctRaw = row.billable_hours_percent;
  const pct =
    pctRaw != null && String(pctRaw).trim() !== "" ? clampBillableHoursPercent(parseMoney(pctRaw)) : 100;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    lineOrder: row.line_order,
    lineType: row.line_type ?? "BILLABLE",
    description: row.description,
    quantity: parseMoney(row.quantity),
    unitPrice: parseMoney(row.unit_price),
    billableHoursPercent: pct,
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
  issuerCode: string,
  lines: BillingInvoiceLineRow[]
): BillingInvoiceRecord {
  return {
    id: row.id,
    issuerId: row.issuer_id,
    issuerCode,
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
    issuerLogoStoragePath: row.issuer_logo_storage_path,
    issuerWebsiteUrl: row.issuer_website_url,
    issuerPrivacyFooter: row.issuer_privacy_footer,
    issuerEmail: row.issuer_email,
    issuerPhone: row.issuer_phone,
    recipientName: row.recipient_name,
    recipientTaxId: row.recipient_tax_id,
    recipientFiscalAddress: row.recipient_fiscal_address,
    recipientWebsiteUrl: row.recipient_website_url,
    recipientAddresseeLine: row.recipient_addressee_line?.trim() ? row.recipient_addressee_line.trim() : null,
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
    issuerId: s.issuer_id,
    code: s.code,
    label: s.label,
    active: s.active,
  }));
}

function issuerRowToDomain(row: BillingIssuerRow): BillingIssuerRecord {
  return {
    id: row.id,
    code: row.code,
    legalName: row.legal_name,
    taxId: row.tax_id,
    fiscalAddress: row.fiscal_address,
    bankAccountIban: row.bank_account_iban,
    bankAccountSwift: row.bank_account_swift,
    bankName: row.bank_name,
    email: row.email,
    phone: row.phone,
    logoStoragePath: row.logo_storage_path,
    websiteUrl: row.website_url,
    privacyFooterText: row.privacy_footer_text,
    active: row.active,
  };
}

const BILLING_ISSUER_LOGO_PREFIX = "billing-issuer-logos";

async function syncDraftInvoicesIssuerLogo(issuerId: string, logoPath: string | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_invoices")
    .update({ issuer_logo_storage_path: logoPath, updated_at: new Date().toISOString() })
    .eq("issuer_id", issuerId)
    .eq("status", "DRAFT");
  if (error) throwErr(error);
}

async function syncDraftInvoicesIssuerWebsite(issuerId: string, websiteUrl: string | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_invoices")
    .update({ issuer_website_url: websiteUrl, updated_at: new Date().toISOString() })
    .eq("issuer_id", issuerId)
    .eq("status", "DRAFT");
  if (error) throwErr(error);
}

async function syncDraftInvoicesIssuerPrivacyFooter(
  issuerId: string,
  taxId: string,
  privacyFooterText: string | null
): Promise<void> {
  const footer = issuerPrivacyFooterForDraftSnapshot({ taxId, privacyFooterText });
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_invoices")
    .update({ issuer_privacy_footer: footer, updated_at: new Date().toISOString() })
    .eq("issuer_id", issuerId)
    .eq("status", "DRAFT");
  if (error) throwErr(error);
}

async function syncDraftInvoicesIssuerContact(
  issuerId: string,
  email: string | null,
  phone: string | null
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_invoices")
    .update({
      issuer_email: email?.trim() || null,
      issuer_phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("issuer_id", issuerId)
    .eq("status", "DRAFT");
  if (error) throwErr(error);
}

/** Al cambiar la web del cliente, actualiza borradores que lo usan. */
export async function syncDraftInvoicesRecipientWebsite(clientId: string, websiteUrl: string | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_invoices")
    .update({ recipient_website_url: websiteUrl, updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("status", "DRAFT");
  if (error) throwErr(error);
}

/** Data URL para incrustar en PDF (bucket privado vía URL firmada). */
export async function fetchBillingIssuerLogoDataUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null;
  const sb = requireSupabase();
  const { data, error } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  const r = await fetch(data.signedUrl);
  if (!r.ok) return null;
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("No se pudo leer el logo."));
    fr.readAsDataURL(blob);
  });
}

export async function uploadBillingIssuerLogo(issuerId: string, file: File): Promise<BillingIssuerRecord> {
  await requireProfile();
  const allowed = ["image/png", "image/jpeg"];
  if (!allowed.includes(file.type)) throw new Error("Usa una imagen PNG o JPEG.");
  if (file.size > 2 * 1024 * 1024) throw new Error("El logo no puede superar 2 MB.");

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${BILLING_ISSUER_LOGO_PREFIX}/${issuerId}/logo.${ext}`;
  const sb = requireSupabase();

  const { data: cur, error: curErr } = await sb.from("billing_issuers").select("logo_storage_path").eq("id", issuerId).maybeSingle();
  if (curErr) throwErr(curErr);
  const oldPath = (cur as { logo_storage_path: string | null } | null)?.logo_storage_path;
  if (oldPath) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([oldPath]).catch(() => undefined);
  }

  const { error: upErr } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (upErr) throwErr(upErr);

  const { data: row, error } = await sb
    .from("billing_issuers")
    .update({ logo_storage_path: path, updated_at: new Date().toISOString() })
    .eq("id", issuerId)
    .select("*")
    .single();
  if (error) throwErr(error);

  await syncDraftInvoicesIssuerLogo(issuerId, path);
  return issuerRowToDomain(row as BillingIssuerRow);
}

export async function removeBillingIssuerLogo(issuerId: string): Promise<void> {
  await requireProfile();
  const sb = requireSupabase();
  const { data: cur, error: curErr } = await sb.from("billing_issuers").select("logo_storage_path").eq("id", issuerId).maybeSingle();
  if (curErr) throwErr(curErr);
  const oldPath = (cur as { logo_storage_path: string | null } | null)?.logo_storage_path;
  if (oldPath) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([oldPath]).catch(() => undefined);
  }
  const { error } = await sb
    .from("billing_issuers")
    .update({ logo_storage_path: null, updated_at: new Date().toISOString() })
    .eq("id", issuerId);
  if (error) throwErr(error);
  await syncDraftInvoicesIssuerLogo(issuerId, null);
}

export async function fetchBillingIssuers(): Promise<BillingIssuerRecord[]> {
  await requireProfile();
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_issuers").select("*").order("code", { ascending: true });
  if (error) throwErr(error);
  return ((data ?? []) as BillingIssuerRow[]).map(issuerRowToDomain);
}

export async function createBillingIssuer(input: {
  code: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  bankAccountIban?: string | null;
  bankAccountSwift?: string | null;
  bankName?: string | null;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  privacyFooterText?: string | null;
}): Promise<BillingIssuerRecord> {
  await requireProfile();
  const code = input.code.trim().toUpperCase();
  const legalName = input.legalName.trim();
  const taxId = input.taxId.trim().toUpperCase();
  const fiscalAddress = input.fiscalAddress.trim();
  if (!code) throw new Error("Indica un código corto para el emisor (ej. sociedad matriz).");
  if (!legalName) throw new Error("Indica la razón social del emisor.");
  if (!taxId) throw new Error("Indica el NIF/CIF del emisor.");
  if (!fiscalAddress) throw new Error("Indica la dirección fiscal del emisor.");

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("billing_issuers")
    .insert({
      code,
      legal_name: legalName,
      tax_id: taxId,
      fiscal_address: fiscalAddress,
      bank_account_iban: input.bankAccountIban?.trim() || null,
      bank_account_swift: input.bankAccountSwift?.trim().toUpperCase() || null,
      bank_name: input.bankName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      privacy_footer_text: input.privacyFooterText?.trim() || null,
      active: true,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return issuerRowToDomain(data as BillingIssuerRow);
}

export async function updateBillingIssuer(
  issuerId: string,
  input: {
    code: string;
    legalName: string;
    taxId: string;
    fiscalAddress: string;
    bankAccountIban?: string | null;
    bankAccountSwift?: string | null;
    bankName?: string | null;
    email?: string | null;
    phone?: string | null;
    websiteUrl?: string | null;
    privacyFooterText?: string | null;
  }
): Promise<BillingIssuerRecord> {
  await requireProfile();
  const code = input.code.trim().toUpperCase();
  const legalName = input.legalName.trim();
  const taxId = input.taxId.trim().toUpperCase();
  const fiscalAddress = input.fiscalAddress.trim();
  if (!code) throw new Error("Indica un código corto para el emisor.");
  if (!legalName) throw new Error("Indica la razón social del emisor.");
  if (!taxId) throw new Error("Indica el NIF/CIF del emisor.");
  if (!fiscalAddress) throw new Error("Indica la dirección fiscal del emisor.");

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("billing_issuers")
    .update({
      code,
      legal_name: legalName,
      tax_id: taxId,
      fiscal_address: fiscalAddress,
      bank_account_iban: input.bankAccountIban?.trim() || null,
      bank_account_swift: input.bankAccountSwift?.trim().toUpperCase() || null,
      bank_name: input.bankName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      privacy_footer_text: input.privacyFooterText?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", issuerId)
    .select("*")
    .single();
  if (error) throwErr(error);
  const row = data as BillingIssuerRow;
  await syncDraftInvoicesIssuerWebsite(issuerId, row.website_url?.trim() ? row.website_url.trim() : null);
  await syncDraftInvoicesIssuerPrivacyFooter(issuerId, row.tax_id, row.privacy_footer_text);
  await syncDraftInvoicesIssuerContact(issuerId, row.email, row.phone);
  return issuerRowToDomain(row);
}

export async function setBillingIssuerActive(issuerId: string, active: boolean): Promise<void> {
  await requireProfile();
  const sb = requireSupabase();
  const { error } = await sb
    .from("billing_issuers")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", issuerId);
  if (error) throwErr(error);
}

async function assertSeriesBelongsToIssuer(seriesId: string, issuerId: string): Promise<void> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_series").select("issuer_id").eq("id", seriesId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Serie no encontrada.");
  if ((data as BillingSeriesRow).issuer_id !== issuerId) {
    throw new Error("La serie no pertenece al emisor indicado.");
  }
}

export async function createBillingSeries(input: {
  issuerId: string;
  code: string;
  label: string;
}): Promise<BillingSeriesRecord> {
  await requireProfile();
  const code = input.code.trim().toUpperCase();
  const label = input.label.trim();
  if (!input.issuerId) throw new Error("Selecciona el emisor de la serie.");
  if (!code) throw new Error("Indica el código de la serie.");
  if (!label) throw new Error("Indica el nombre de la serie.");

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("billing_series")
    .upsert(
      { issuer_id: input.issuerId, code, label, active: true },
      { onConflict: "issuer_id,code" }
    )
    .select("*")
    .single();
  if (error) throwErr(error);
  const row = data as BillingSeriesRow;
  return { id: row.id, issuerId: row.issuer_id, code: row.code, label: row.label, active: row.active };
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

  const { data: issuerRows, error: issErr } = await sb.from("billing_issuers").select("id, code");
  if (issErr) throwErr(issErr);
  const issuerCodeById = new Map((issuerRows ?? []).map((r) => [(r as { id: string; code: string }).id, (r as { id: string; code: string }).code]));

  const byInvoice = new Map<string, BillingInvoiceLineRow[]>();
  for (const id of invoiceIds) byInvoice.set(id, []);
  for (const ln of (lineRows ?? []) as BillingInvoiceLineRow[]) byInvoice.get(ln.invoice_id)?.push(ln);

  return (rows as BillingInvoiceRow[]).map((inv) =>
    invoiceRowToDomain(
      inv,
      seriesById.get(inv.series_id)?.code ?? "?",
      issuerCodeById.get(inv.issuer_id) ?? "?",
      byInvoice.get(inv.id) ?? []
    )
  );
}

async function loadIssuerSnapshot(
  issuerId: string,
  opts: { requireActive: boolean }
): Promise<{
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  bankAccountIban: string | null;
  bankAccountSwift: string | null;
  bankName: string | null;
  logoStoragePath: string | null;
  websiteUrl: string | null;
  privacyFooterText: string | null;
  email: string | null;
  phone: string | null;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_issuers").select("*").eq("id", issuerId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Emisor no encontrado.");
  const row = data as BillingIssuerRow;
  if (opts.requireActive && !row.active) throw new Error("El emisor está inactivo. Actívalo o elige otro.");
  const web = row.website_url?.trim();
  const pf = row.privacy_footer_text?.trim();
  const em = row.email?.trim();
  const ph = row.phone?.trim();
  return {
    legalName: row.legal_name,
    taxId: row.tax_id,
    fiscalAddress: row.fiscal_address,
    bankAccountIban: row.bank_account_iban,
    bankAccountSwift: row.bank_account_swift,
    bankName: row.bank_name,
    logoStoragePath: row.logo_storage_path,
    websiteUrl: web ? web : null,
    privacyFooterText: pf ? pf : null,
    email: em ? em : null,
    phone: ph ? ph : null,
  };
}

async function resolveClientSnapshot(clientId: string): Promise<{
  name: string;
  taxId: string;
  fiscalAddress: string;
  websiteUrl: string | null;
  invoiceAddresseeLine: string | null;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Cliente no encontrado.");
  const client = data as ClientRow;
  const name = (client.company_name || client.trade_name || "").trim();
  const fiscalAddress = (client.fiscal_address || client.postal_address || "").trim();
  const w = client.website_url?.trim();
  const addressee = client.invoice_addressee_line?.trim();
  return {
    name,
    taxId: (client.cif || "").trim(),
    fiscalAddress,
    websiteUrl: w ? w : null,
    invoiceAddresseeLine: addressee ? addressee : null,
  };
}

export async function createBillingInvoiceDraft(input: BillingInvoiceDraftInput): Promise<BillingInvoiceRecord> {
  const profile = await requireProfile();
  const issuer = await loadIssuerSnapshot(input.issuerId, {
    requireActive: !input.allowInactiveIssuer,
  });
  const recipient = await resolveClientSnapshot(input.clientId);
  if (!recipient.name) throw new Error("El cliente no tiene nombre comercial o razón social informada.");
  if (!recipient.taxId) throw new Error("El cliente no tiene NIF/CIF informado.");
  if (!recipient.fiscalAddress) throw new Error("El cliente no tiene dirección fiscal informada.");

  await assertSeriesBelongsToIssuer(input.seriesId, input.issuerId);

  const sb = requireSupabase();
  const { data: row, error } = await sb
    .from("billing_invoices")
    .insert({
      issuer_id: input.issuerId,
      series_id: input.seriesId,
      status: "DRAFT",
      payment_status: "PENDING",
      invoice_kind: input.invoiceKind ?? "NORMAL",
      rectifies_invoice_id: input.rectifiesInvoiceId ?? null,
      issue_date: input.issueDate?.trim() ? input.issueDate.trim() : null,
      due_date: input.dueDate ?? null,
      notes: input.notes?.trim() ?? "",
      client_id: input.clientId,
      issuer_name: issuer.legalName,
      issuer_tax_id: issuer.taxId,
      issuer_fiscal_address: issuer.fiscalAddress,
      issuer_bank_account_iban: issuer.bankAccountIban,
      issuer_bank_account_swift: issuer.bankAccountSwift,
      issuer_bank_name: issuer.bankName,
      issuer_logo_storage_path: issuer.logoStoragePath,
      issuer_website_url: issuer.websiteUrl,
      issuer_privacy_footer: issuerPrivacyFooterForDraftSnapshot({
        taxId: issuer.taxId,
        privacyFooterText: issuer.privacyFooterText,
      }),
      issuer_email: issuer.email,
      issuer_phone: issuer.phone,
      recipient_name: recipient.name,
      recipient_tax_id: recipient.taxId,
      recipient_fiscal_address: recipient.fiscalAddress,
      recipient_website_url: recipient.websiteUrl,
      recipient_addressee_line: null,
      created_by_backoffice_user_id: profile.id,
      updated_by_backoffice_user_id: profile.id,
    })
    .select("*")
    .single();
  if (error) throwErr(error);

  const newRow = row as BillingInvoiceRow;
  const newId = newRow.id;

  await appendAudit("INVOICE", newId, "DRAFT_CREATED", { clientId: input.clientId }, profile.id);

  const copyFrom = input.copyLinesFromInvoiceId?.trim();
  if (copyFrom) {
    const { data: src, error: srcErr } = await sb.from("billing_invoices").select("*").eq("id", copyFrom).maybeSingle();
    if (srcErr) throwErr(srcErr);
    if (!src) throw new Error("Factura origen no encontrada.");
    const srcInv = src as BillingInvoiceRow;
    if (srcInv.client_id !== input.clientId) {
      throw new Error("La factura origen no corresponde al cliente seleccionado.");
    }
    if (srcInv.status === "CANCELLED") {
      throw new Error("No se pueden copiar líneas de una factura anulada.");
    }
    const { data: lineRows, error: lineErr } = await sb
      .from("billing_invoice_lines")
      .select("*")
      .eq("invoice_id", copyFrom)
      .order("line_order", { ascending: true });
    if (lineErr) throwErr(lineErr);
    const lineInputs = ((lineRows ?? []) as BillingInvoiceLineRow[]).map(lineRowToDraftInput);
    await replaceBillingInvoiceLines(newId, lineInputs);
    await appendAudit("INVOICE", newId, "DRAFT_LINES_COPIED_FROM", { fromInvoiceId: copyFrom }, profile.id);
  }

  const seriesRows = await fetchBillingSeries();
  const issuers = await fetchBillingIssuers();
  const series = seriesRows.find((s) => s.id === newRow.series_id);
  const issuerCode = issuers.find((i) => i.id === newRow.issuer_id)?.code ?? "?";

  const { data: newLines, error: nlErr } = await sb
    .from("billing_invoice_lines")
    .select("*")
    .eq("invoice_id", newId)
    .order("line_order", { ascending: true });
  if (nlErr) throwErr(nlErr);

  return invoiceRowToDomain(newRow, series?.code ?? "?", issuerCode, (newLines ?? []) as BillingInvoiceLineRow[]);
}

export async function createRectificativeDraftFromInvoice(originalInvoiceId: string, seriesId: string): Promise<BillingInvoiceRecord> {
  const all = await fetchBillingInvoices();
  const source = all.find((i) => i.id === originalInvoiceId);
  if (!source) throw new Error("Factura origen no encontrada.");
  return createBillingInvoiceDraft({
    issuerId: source.issuerId,
    seriesId,
    clientId: source.clientId,
    invoiceKind: "RECTIFICATIVE",
    rectifiesInvoiceId: source.id,
    dueDate: source.dueDate,
    notes: `Rectificativa de ${source.seriesCode}-${source.fiscalYear ?? "----"}/${source.invoiceNumber ?? ""}`.trim(),
    allowInactiveIssuer: true,
  });
}

function lineRowToDraftInput(row: BillingInvoiceLineRow): BillingInvoiceLineInput {
  const lt = row.line_type ?? "BILLABLE";
  const pctRaw = row.billable_hours_percent;
  const pct =
    pctRaw != null && String(pctRaw).trim() !== "" ? clampBillableHoursPercent(parseMoney(pctRaw)) : 100;
  return {
    lineType: lt as BillingInvoiceLineInput["lineType"],
    description: row.description ?? "",
    quantity: parseMoney(row.quantity),
    unitPrice: parseMoney(row.unit_price),
    billableHoursPercent: lt === "BILLABLE" ? pct : 100,
    vatRate: parseMoney(row.vat_rate) as BillingInvoiceLineInput["vatRate"],
    irpfRate: parseMoney(row.irpf_rate),
  };
}

/** Copia cabecera y líneas de un borrador a uno nuevo (misma numeración de serie al emitir; nuevo id). */
export async function duplicateBillingInvoiceDraft(sourceInvoiceId: string): Promise<BillingInvoiceRecord> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data: src, error: srcErr } = await sb.from("billing_invoices").select("*").eq("id", sourceInvoiceId).maybeSingle();
  if (srcErr) throwErr(srcErr);
  if (!src) throw new Error("Borrador no encontrado.");
  const srcRow = src as BillingInvoiceRow;
  if (srcRow.status !== "DRAFT") throw new Error("Solo se pueden duplicar borradores.");

  const { data: lineRows, error: lineErr } = await sb
    .from("billing_invoice_lines")
    .select("*")
    .eq("invoice_id", sourceInvoiceId)
    .order("line_order", { ascending: true });
  if (lineErr) throwErr(lineErr);

  const { data: row, error: insErr } = await sb
    .from("billing_invoices")
    .insert({
      issuer_id: srcRow.issuer_id,
      series_id: srcRow.series_id,
      status: "DRAFT",
      payment_status: "PENDING",
      invoice_kind: srcRow.invoice_kind,
      rectifies_invoice_id: srcRow.rectifies_invoice_id,
      due_date: srcRow.due_date,
      notes: srcRow.notes,
      client_id: srcRow.client_id,
      issuer_name: srcRow.issuer_name,
      issuer_tax_id: srcRow.issuer_tax_id,
      issuer_fiscal_address: srcRow.issuer_fiscal_address,
      issuer_bank_account_iban: srcRow.issuer_bank_account_iban,
      issuer_bank_account_swift: srcRow.issuer_bank_account_swift,
      issuer_bank_name: srcRow.issuer_bank_name,
      issuer_logo_storage_path: srcRow.issuer_logo_storage_path,
      issuer_website_url: srcRow.issuer_website_url,
      issuer_privacy_footer: srcRow.issuer_privacy_footer,
      issuer_email: srcRow.issuer_email,
      issuer_phone: srcRow.issuer_phone,
      recipient_name: srcRow.recipient_name,
      recipient_tax_id: srcRow.recipient_tax_id,
      recipient_fiscal_address: srcRow.recipient_fiscal_address,
      recipient_website_url: srcRow.recipient_website_url,
      recipient_addressee_line: srcRow.recipient_addressee_line,
      issue_date: srcRow.issue_date,
      taxable_base_total: 0,
      vat_total: 0,
      irpf_total: 0,
      grand_total: 0,
      collected_total: 0,
      verifactu_submission_status: "PENDING",
      created_by_backoffice_user_id: profile.id,
      updated_by_backoffice_user_id: profile.id,
    })
    .select("*")
    .single();
  if (insErr) throwErr(insErr);

  const newRow = row as BillingInvoiceRow;
  const lineInputs = ((lineRows ?? []) as BillingInvoiceLineRow[]).map(lineRowToDraftInput);
  await replaceBillingInvoiceLines(newRow.id, lineInputs);

  await appendAudit(
    "INVOICE",
    newRow.id,
    "DRAFT_DUPLICATED",
    { fromInvoiceId: sourceInvoiceId },
    profile.id
  );

  const seriesRows = await fetchBillingSeries();
  const issuers = await fetchBillingIssuers();
  const series = seriesRows.find((s) => s.id === newRow.series_id);
  const issuerCode = issuers.find((i) => i.id === newRow.issuer_id)?.code ?? "?";

  const { data: newLines, error: nlErr } = await sb
    .from("billing_invoice_lines")
    .select("*")
    .eq("invoice_id", newRow.id)
    .order("line_order", { ascending: true });
  if (nlErr) throwErr(nlErr);

  return invoiceRowToDomain(newRow, series?.code ?? "?", issuerCode, (newLines ?? []) as BillingInvoiceLineRow[]);
}

/** Borrado físico de un borrador (facturas emitidas no se borran aquí). */
export async function deleteBillingInvoiceDraft(invoiceId: string): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data: inv, error: invErr } = await sb.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (invErr) throwErr(invErr);
  if (!inv) throw new Error("Factura no encontrada.");
  const row = inv as BillingInvoiceRow;
  if (row.status !== "DRAFT") throw new Error("Solo se pueden borrar borradores.");

  await appendAudit("INVOICE", invoiceId, "DRAFT_DELETED", {}, profile.id);

  const { error: recErr } = await sb.from("billing_receipts").delete().eq("invoice_id", invoiceId);
  if (recErr) throwErr(recErr);

  const { error: delErr } = await sb.from("billing_invoices").delete().eq("id", invoiceId);
  if (delErr) throwErr(delErr);
}

export async function updateBillingInvoiceDraftHeader(
  invoiceId: string,
  patch: {
    dueDate?: string | null;
    /** Fecha de factura prevista (solo borrador). Vacío borra el valor; al emitir sin forzar se usa la fecha del momento. */
    issueDate?: string | null;
    notes?: string;
    issuerId?: string;
    seriesId?: string;
    recipientAddresseeLine?: string | null;
  }
): Promise<void> {
  const profile = await requireProfile();
  const sb = requireSupabase();
  const { data, error } = await sb.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error) throwErr(error);
  if (!data) throw new Error("Factura no encontrada.");
  const row = data as BillingInvoiceRow;
  if (row.status !== "DRAFT") throw new Error("Solo se puede editar cabecera en borrador.");

  const targetIssuerId = patch.issuerId ?? row.issuer_id;
  let finalSeriesId = row.series_id;

  if (patch.seriesId !== undefined) {
    await assertSeriesBelongsToIssuer(patch.seriesId, targetIssuerId);
    finalSeriesId = patch.seriesId;
  } else if (patch.issuerId !== undefined) {
    const { data: sers, error: se } = await sb
      .from("billing_series")
      .select("id")
      .eq("issuer_id", patch.issuerId)
      .eq("active", true)
      .order("code", { ascending: true })
      .limit(1);
    if (se) throwErr(se);
    if (!sers?.length) {
      throw new Error("No hay series activas para ese emisor. Crea una serie para ese emisor primero.");
    }
    finalSeriesId = (sers[0] as { id: string }).id;
  }

  let issuerPatch: Record<string, unknown> = {};
  if (patch.issuerId !== undefined) {
    const snap = await loadIssuerSnapshot(patch.issuerId, { requireActive: false });
    issuerPatch = {
      issuer_id: patch.issuerId,
      issuer_name: snap.legalName,
      issuer_tax_id: snap.taxId,
      issuer_fiscal_address: snap.fiscalAddress,
      issuer_bank_account_iban: snap.bankAccountIban,
      issuer_bank_account_swift: snap.bankAccountSwift,
      issuer_bank_name: snap.bankName,
      issuer_logo_storage_path: snap.logoStoragePath,
      issuer_website_url: snap.websiteUrl,
      issuer_privacy_footer: issuerPrivacyFooterForDraftSnapshot({
        taxId: snap.taxId,
        privacyFooterText: snap.privacyFooterText,
      }),
      issuer_email: snap.email,
      issuer_phone: snap.phone,
    };
  }

  const nextAddressee =
    patch.recipientAddresseeLine !== undefined
      ? patch.recipientAddresseeLine?.trim()
        ? patch.recipientAddresseeLine.trim()
        : null
      : row.recipient_addressee_line ?? null;

  let nextIssueDate: string | null | undefined = undefined;
  if (patch.issueDate !== undefined) {
    const t = patch.issueDate?.trim();
    nextIssueDate = t ? t : null;
  }

  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({
      ...issuerPatch,
      series_id: finalSeriesId,
      due_date: patch.dueDate ?? row.due_date,
      ...(nextIssueDate !== undefined ? { issue_date: nextIssueDate } : {}),
      notes: patch.notes !== undefined ? patch.notes.trim() : row.notes,
      recipient_addressee_line: nextAddressee,
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
      billable_hours_percent: line.lineType === "BILLABLE" ? clampBillableHoursPercent(line.billableHoursPercent ?? 100) : 100,
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
