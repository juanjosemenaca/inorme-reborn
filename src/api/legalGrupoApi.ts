import { requireSupabase } from "@/api/supabaseRequire";
import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import type {
  LegalCalendarEventRow,
  LegalClientRow,
  LegalContactRow,
  LegalDocumentRow,
  LegalInvoiceLineRow,
  LegalInvoiceRow,
  LegalMatterActivityRow,
  LegalMatterRow,
  LegalProcedureRow,
  LegalTimeEntryRow,
} from "@/types/database";
import type {
  LegalBillingModel,
  LegalCalendarEventRecord,
  LegalCalendarEventType,
  LegalClientRecord,
  LegalClientType,
  LegalContactRecord,
  LegalDocumentRecord,
  LegalInvoiceLineRecord,
  LegalInvoiceLineType,
  LegalInvoiceRecord,
  LegalInvoiceStatus,
  LegalKeyDateEntry,
  LegalMatterActivityRecord,
  LegalMatterRecord,
  LegalMatterStatus,
  LegalMatterType,
  LegalProcedureRecord,
  LegalTimeEntryRecord,
} from "@/types/legalGrupo";

function throwErr(e: unknown): never {
  if (e && typeof e === "object" && "message" in e) throw new Error(String((e as { message: unknown }).message));
  throw e;
}

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseKeyDates(raw: unknown): LegalKeyDateEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LegalKeyDateEntry[] = [];
  for (const x of raw) {
    if (x && typeof x === "object" && "label" in x && "date" in x) {
      const label = String((x as { label: unknown }).label ?? "");
      const date = String((x as { date: unknown }).date ?? "");
      if (label && date) out.push({ label, date });
    }
  }
  return out;
}

function clientRowToDomain(row: LegalClientRow): LegalClientRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    taxId: row.tax_id,
    fiscalAddress: row.fiscal_address,
    clientType: row.client_type as LegalClientType,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contactRowToDomain(row: LegalContactRow): LegalContactRecord {
  return {
    id: row.id,
    legalClientId: row.legal_client_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mobile: row.mobile,
    position: row.position,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function matterRowToDomain(row: LegalMatterRow): LegalMatterRecord {
  return {
    id: row.id,
    legalClientId: row.legal_client_id,
    matterCode: row.matter_code,
    matterType: row.matter_type as LegalMatterType,
    status: row.status as LegalMatterStatus,
    responsibleLawyerId: row.responsible_lawyer_id,
    title: row.title,
    description: row.description,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    keyDates: parseKeyDates(row.key_dates),
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function activityRowToDomain(row: LegalMatterActivityRow): LegalMatterActivityRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    activityType: row.activity_type,
    title: row.title,
    body: row.body,
    metadata: row.metadata ?? {},
    occurredAt: row.occurred_at,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    createdAt: row.created_at,
  };
}

function docRowToDomain(row: LegalDocumentRow): LegalDocumentRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    name: row.name,
    docType: row.doc_type,
    version: row.version,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedByBackofficeUserId: row.uploaded_by_backoffice_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function procedureRowToDomain(row: LegalProcedureRow): LegalProcedureRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    courtName: row.court_name,
    procedureNumber: row.procedure_number,
    proceduralStatus: row.procedural_status,
    keyDates: parseKeyDates(row.key_dates),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function invoiceRowToDomain(row: LegalInvoiceRow, lines?: LegalInvoiceLineRow[]): LegalInvoiceRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    legalClientId: row.legal_client_id,
    invoiceNumber: row.invoice_number,
    status: row.status as LegalInvoiceStatus,
    billingModel: row.billing_model as LegalBillingModel,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    subtotal: num(row.subtotal),
    taxTotal: num(row.tax_total),
    grandTotal: num(row.grand_total),
    notes: row.notes,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines: lines?.map(lineRowToDomain),
  };
}

function lineRowToDomain(row: LegalInvoiceLineRow): LegalInvoiceLineRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    lineOrder: row.line_order,
    lineType: row.line_type as LegalInvoiceLineType,
    description: row.description,
    quantity: num(row.quantity),
    unitPrice: num(row.unit_price),
    lineTotal: num(row.line_total),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function timeRowToDomain(row: LegalTimeEntryRow): LegalTimeEntryRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    backofficeUserId: row.backoffice_user_id,
    workDate: row.work_date,
    hours: num(row.hours),
    description: row.description,
    billable: row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function calRowToDomain(row: LegalCalendarEventRow): LegalCalendarEventRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    eventType: row.event_type as LegalCalendarEventType,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reminderAt: row.reminder_at,
    allDay: row.all_day,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireActorId(): Promise<string | null> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return null;
  const profile = await getProfileByAuthUserId(uid);
  return profile?.id ?? null;
}

// ——— Clientes ———

export async function fetchLegalClients(): Promise<LegalClientRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => clientRowToDomain(r as LegalClientRow));
}

export type CreateLegalClientInput = {
  displayName: string;
  taxId: string;
  fiscalAddress?: string;
  clientType: LegalClientType;
  email?: string;
  phone?: string;
  notes?: string;
  active?: boolean;
};

export async function createLegalClient(input: CreateLegalClientInput): Promise<LegalClientRecord> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_clients")
    .insert({
      display_name: input.displayName.trim(),
      tax_id: input.taxId.trim(),
      fiscal_address: input.fiscalAddress?.trim() ?? "",
      client_type: input.clientType,
      email: input.email?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      active: input.active !== false,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return clientRowToDomain(data as LegalClientRow);
}

export async function updateLegalClient(
  id: string,
  patch: Partial<CreateLegalClientInput>
): Promise<LegalClientRecord> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.taxId !== undefined) row.tax_id = patch.taxId.trim();
  if (patch.fiscalAddress !== undefined) row.fiscal_address = patch.fiscalAddress.trim();
  if (patch.clientType !== undefined) row.client_type = patch.clientType;
  if (patch.email !== undefined) row.email = patch.email.trim();
  if (patch.phone !== undefined) row.phone = patch.phone.trim();
  if (patch.notes !== undefined) row.notes = patch.notes.trim();
  if (patch.active !== undefined) row.active = patch.active;
  const { data, error } = await sb.from("legal_clients").update(row).eq("id", id).select("*").single();
  if (error) throwErr(error);
  return clientRowToDomain(data as LegalClientRow);
}

// ——— Contactos ———

export async function fetchLegalContacts(legalClientId: string): Promise<LegalContactRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_contacts")
    .select("*")
    .eq("legal_client_id", legalClientId)
    .order("created_at", { ascending: true });
  if (error) throwErr(error);
  return (data ?? []).map((r) => contactRowToDomain(r as LegalContactRow));
}

export async function createLegalContact(input: {
  legalClientId: string;
  firstName: string;
  lastName: string;
  email?: string;
  mobile?: string;
  position?: string;
  notes?: string;
}): Promise<LegalContactRecord> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_contacts")
    .insert({
      legal_client_id: input.legalClientId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: input.email?.trim() ?? "",
      mobile: input.mobile?.trim() ?? "",
      position: input.position?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return contactRowToDomain(data as LegalContactRow);
}

// ——— Expedientes ———

export async function fetchLegalMatters(): Promise<LegalMatterRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_matters")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => matterRowToDomain(r as LegalMatterRow));
}

export async function fetchLegalMatterById(id: string): Promise<LegalMatterRecord | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("legal_matters").select("*").eq("id", id).maybeSingle();
  if (error) throwErr(error);
  if (!data) return null;
  return matterRowToDomain(data as LegalMatterRow);
}

export type CreateLegalMatterInput = {
  legalClientId: string;
  matterCode?: string | null;
  matterType: LegalMatterType;
  status?: LegalMatterStatus;
  responsibleLawyerId?: string | null;
  title: string;
  description?: string;
  openedAt?: string | null;
  keyDates?: LegalKeyDateEntry[];
};

export async function createLegalMatter(input: CreateLegalMatterInput): Promise<LegalMatterRecord> {
  const sb = requireSupabase();
  const actor = await requireActorId();
  const { data, error } = await sb
    .from("legal_matters")
    .insert({
      legal_client_id: input.legalClientId,
      matter_code: input.matterCode?.trim() || null,
      matter_type: input.matterType,
      status: input.status ?? "OPEN",
      responsible_lawyer_id: input.responsibleLawyerId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      opened_at: input.openedAt ?? new Date().toISOString().slice(0, 10),
      key_dates: input.keyDates ?? [],
      created_by_backoffice_user_id: actor,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return matterRowToDomain(data as LegalMatterRow);
}

export async function updateLegalMatter(
  id: string,
  patch: Partial<CreateLegalMatterInput> & { closedAt?: string | null }
): Promise<LegalMatterRecord> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.legalClientId !== undefined) row.legal_client_id = patch.legalClientId;
  if (patch.matterCode !== undefined) row.matter_code = patch.matterCode?.trim() || null;
  if (patch.matterType !== undefined) row.matter_type = patch.matterType;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.responsibleLawyerId !== undefined) row.responsible_lawyer_id = patch.responsibleLawyerId;
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description.trim();
  if (patch.openedAt !== undefined) row.opened_at = patch.openedAt;
  if (patch.keyDates !== undefined) row.key_dates = patch.keyDates;
  if (patch.closedAt !== undefined) row.closed_at = patch.closedAt;
  const { data, error } = await sb.from("legal_matters").update(row).eq("id", id).select("*").single();
  if (error) throwErr(error);
  return matterRowToDomain(data as LegalMatterRow);
}

// ——— Actuaciones ———

export async function fetchLegalMatterActivities(matterId: string): Promise<LegalMatterActivityRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_matter_activities")
    .select("*")
    .eq("matter_id", matterId)
    .order("occurred_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => activityRowToDomain(r as LegalMatterActivityRow));
}

export async function createLegalMatterActivity(input: {
  matterId: string;
  activityType?: string;
  title: string;
  body?: string;
  occurredAt?: string;
}): Promise<LegalMatterActivityRecord> {
  const sb = requireSupabase();
  const actor = await requireActorId();
  const { data, error } = await sb
    .from("legal_matter_activities")
    .insert({
      matter_id: input.matterId,
      activity_type: input.activityType ?? "NOTE",
      title: input.title.trim(),
      body: input.body?.trim() ?? "",
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      created_by_backoffice_user_id: actor,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return activityRowToDomain(data as LegalMatterActivityRow);
}

// ——— Documentos ———

export async function fetchLegalDocuments(matterId: string): Promise<LegalDocumentRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_documents")
    .select("*")
    .eq("matter_id", matterId)
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => docRowToDomain(r as LegalDocumentRow));
}

export async function uploadLegalDocument(input: {
  matterId: string;
  file: File;
  name: string;
  docType?: string;
  version?: number;
}): Promise<LegalDocumentRecord> {
  const sb = requireSupabase();
  const actor = await requireActorId();
  const ext = input.file.name.includes(".") ? input.file.name.split(".").pop() : "bin";
  const path = `${input.matterId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage.from("legal-documents").upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file.type || undefined,
  });
  if (upErr) throwErr(upErr);
  const { data, error } = await sb
    .from("legal_documents")
    .insert({
      matter_id: input.matterId,
      name: input.name.trim(),
      doc_type: input.docType ?? "OTHER",
      version: input.version ?? 1,
      storage_bucket: "legal-documents",
      storage_path: path,
      mime_type: input.file.type || "",
      file_size: input.file.size,
      uploaded_by_backoffice_user_id: actor,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return docRowToDomain(data as LegalDocumentRow);
}

export async function getLegalDocumentSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.storage
    .from("legal-documents")
    .createSignedUrl(storagePath, expiresSec);
  if (error) throwErr(error);
  if (!data?.signedUrl) throw new Error("No se pudo generar el enlace de descarga.");
  return data.signedUrl;
}

// ——— Procedimientos ———

export async function fetchLegalProcedures(matterId: string): Promise<LegalProcedureRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_procedures")
    .select("*")
    .eq("matter_id", matterId)
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return (data ?? []).map((r) => procedureRowToDomain(r as LegalProcedureRow));
}

export async function createLegalProcedure(input: {
  matterId: string;
  courtName?: string;
  procedureNumber?: string;
  proceduralStatus?: string;
  keyDates?: LegalKeyDateEntry[];
  notes?: string;
}): Promise<LegalProcedureRecord> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_procedures")
    .insert({
      matter_id: input.matterId,
      court_name: input.courtName?.trim() ?? "",
      procedure_number: input.procedureNumber?.trim() ?? "",
      procedural_status: input.proceduralStatus?.trim() ?? "",
      key_dates: input.keyDates ?? [],
      notes: input.notes?.trim() ?? "",
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return procedureRowToDomain(data as LegalProcedureRow);
}

// ——— Facturas internas ———

async function recalcLegalInvoiceTotals(sb: ReturnType<typeof requireSupabase>, invoiceId: string) {
  const { data: lines, error: lErr } = await sb.from("legal_invoice_lines").select("*").eq("invoice_id", invoiceId);
  if (lErr) throwErr(lErr);
  let subtotal = 0;
  for (const r of lines ?? []) {
    subtotal += num((r as LegalInvoiceLineRow).line_total);
  }
  const { error: uErr } = await sb
    .from("legal_invoices")
    .update({
      subtotal: subtotal.toFixed(2),
      tax_total: "0",
      grand_total: subtotal.toFixed(2),
    })
    .eq("id", invoiceId);
  if (uErr) throwErr(uErr);
}

export async function fetchLegalInvoices(): Promise<LegalInvoiceRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("legal_invoices").select("*").order("created_at", { ascending: false });
  if (error) throwErr(error);
  const invoices = (data ?? []) as LegalInvoiceRow[];
  if (invoices.length === 0) return [];
  const ids = invoices.map((i) => i.id);
  const { data: lineRows, error: lErr } = await sb
    .from("legal_invoice_lines")
    .select("*")
    .in("invoice_id", ids)
    .order("line_order", { ascending: true });
  if (lErr) throwErr(lErr);
  const byInv = new Map<string, LegalInvoiceLineRow[]>();
  for (const r of lineRows ?? []) {
    const row = r as LegalInvoiceLineRow;
    const list = byInv.get(row.invoice_id) ?? [];
    list.push(row);
    byInv.set(row.invoice_id, list);
  }
  return invoices.map((inv) => invoiceRowToDomain(inv, byInv.get(inv.id)));
}

export async function fetchLegalInvoiceById(id: string): Promise<LegalInvoiceRecord | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("legal_invoices").select("*").eq("id", id).maybeSingle();
  if (error) throwErr(error);
  if (!data) return null;
  const { data: lines, error: lErr } = await sb
    .from("legal_invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("line_order", { ascending: true });
  if (lErr) throwErr(lErr);
  return invoiceRowToDomain(data as LegalInvoiceRow, (lines ?? []) as LegalInvoiceLineRow[]);
}

export type LegalInvoiceLineInput = {
  lineOrder: number;
  lineType: LegalInvoiceLineType;
  description: string;
  quantity: number;
  unitPrice: number;
};

export async function createLegalInvoice(input: {
  legalClientId: string;
  matterId?: string | null;
  billingModel?: LegalBillingModel;
  status?: LegalInvoiceStatus;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string;
  lines?: LegalInvoiceLineInput[];
}): Promise<LegalInvoiceRecord> {
  const sb = requireSupabase();
  const actor = await requireActorId();
  const { data: inv, error } = await sb
    .from("legal_invoices")
    .insert({
      legal_client_id: input.legalClientId,
      matter_id: input.matterId ?? null,
      billing_model: input.billingModel ?? "HOURLY",
      status: input.status ?? "DRAFT",
      invoice_number: input.invoiceNumber?.trim() || null,
      issue_date: input.issueDate ?? null,
      due_date: input.dueDate ?? null,
      notes: input.notes?.trim() ?? "",
      created_by_backoffice_user_id: actor,
      subtotal: "0",
      tax_total: "0",
      grand_total: "0",
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  const invoiceId = (inv as LegalInvoiceRow).id;
  if (input.lines?.length) {
    const rows = input.lines.map((l) => ({
      invoice_id: invoiceId,
      line_order: l.lineOrder,
      line_type: l.lineType,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price: l.unitPrice,
      line_total: (l.quantity * l.unitPrice).toFixed(2),
    }));
    const { error: liErr } = await sb.from("legal_invoice_lines").insert(rows);
    if (liErr) throwErr(liErr);
    await recalcLegalInvoiceTotals(sb, invoiceId);
  }
  return (await fetchLegalInvoiceById(invoiceId))!;
}

export async function updateLegalInvoice(
  id: string,
  patch: Partial<{
    status: LegalInvoiceStatus;
    billingModel: LegalBillingModel;
    invoiceNumber: string | null;
    issueDate: string | null;
    dueDate: string | null;
    notes: string;
    matterId: string | null;
    legalClientId: string;
  }>
): Promise<LegalInvoiceRecord> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.billingModel !== undefined) row.billing_model = patch.billingModel;
  if (patch.invoiceNumber !== undefined) row.invoice_number = patch.invoiceNumber?.trim() || null;
  if (patch.issueDate !== undefined) row.issue_date = patch.issueDate;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.notes !== undefined) row.notes = patch.notes.trim();
  if (patch.matterId !== undefined) row.matter_id = patch.matterId;
  if (patch.legalClientId !== undefined) row.legal_client_id = patch.legalClientId;
  const { error } = await sb.from("legal_invoices").update(row).eq("id", id);
  if (error) throwErr(error);
  return (await fetchLegalInvoiceById(id))!;
}

export async function replaceLegalInvoiceLines(invoiceId: string, lines: LegalInvoiceLineInput[]): Promise<void> {
  const sb = requireSupabase();
  const { error: dErr } = await sb.from("legal_invoice_lines").delete().eq("invoice_id", invoiceId);
  if (dErr) throwErr(dErr);
  if (lines.length === 0) {
    await recalcLegalInvoiceTotals(sb, invoiceId);
    return;
  }
  const rows = lines.map((l) => ({
    invoice_id: invoiceId,
    line_order: l.lineOrder,
    line_type: l.lineType,
    description: l.description.trim(),
    quantity: l.quantity,
    unit_price: l.unitPrice,
    line_total: (l.quantity * l.unitPrice).toFixed(2),
  }));
  const { error: iErr } = await sb.from("legal_invoice_lines").insert(rows);
  if (iErr) throwErr(iErr);
  await recalcLegalInvoiceTotals(sb, invoiceId);
}

// ——— Tiempos ———

export async function fetchLegalTimeEntries(filters?: {
  matterId?: string;
  backofficeUserId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<LegalTimeEntryRecord[]> {
  const sb = requireSupabase();
  let q = sb.from("legal_time_entries").select("*").order("work_date", { ascending: false });
  if (filters?.matterId) q = q.eq("matter_id", filters.matterId);
  if (filters?.backofficeUserId) q = q.eq("backoffice_user_id", filters.backofficeUserId);
  if (filters?.fromDate) q = q.gte("work_date", filters.fromDate);
  if (filters?.toDate) q = q.lte("work_date", filters.toDate);
  const { data, error } = await q;
  if (error) throwErr(error);
  return (data ?? []).map((r) => timeRowToDomain(r as LegalTimeEntryRow));
}

export async function createLegalTimeEntry(input: {
  matterId: string;
  backofficeUserId: string;
  workDate: string;
  hours: number;
  description?: string;
  billable?: boolean;
}): Promise<LegalTimeEntryRecord> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("legal_time_entries")
    .insert({
      matter_id: input.matterId,
      backoffice_user_id: input.backofficeUserId,
      work_date: input.workDate,
      hours: input.hours,
      description: input.description?.trim() ?? "",
      billable: input.billable !== false,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return timeRowToDomain(data as LegalTimeEntryRow);
}

// ——— Agenda ———

export async function fetchLegalCalendarEvents(range: {
  fromIso: string;
  toIso: string;
  matterId?: string;
}): Promise<LegalCalendarEventRecord[]> {
  const sb = requireSupabase();
  let q = sb
    .from("legal_calendar_events")
    .select("*")
    .gte("starts_at", range.fromIso)
    .lte("starts_at", range.toIso)
    .order("starts_at", { ascending: true });
  if (range.matterId) q = q.eq("matter_id", range.matterId);
  const { data, error } = await q;
  if (error) throwErr(error);
  return (data ?? []).map((r) => calRowToDomain(r as LegalCalendarEventRow));
}

export async function createLegalCalendarEvent(input: {
  matterId?: string | null;
  eventType: LegalCalendarEventType;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string | null;
  reminderAt?: string | null;
  allDay?: boolean;
}): Promise<LegalCalendarEventRecord> {
  const sb = requireSupabase();
  const actor = await requireActorId();
  const { data, error } = await sb
    .from("legal_calendar_events")
    .insert({
      matter_id: input.matterId ?? null,
      event_type: input.eventType,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      reminder_at: input.reminderAt ?? null,
      all_day: input.allDay ?? false,
      created_by_backoffice_user_id: actor,
    })
    .select("*")
    .single();
  if (error) throwErr(error);
  return calRowToDomain(data as LegalCalendarEventRow);
}
