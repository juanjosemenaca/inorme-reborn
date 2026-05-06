import { requireSupabase } from "@/api/supabaseRequire";
import { createBackofficeMessage } from "@/api/backofficeMessagesApi";
import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  DmsDocumentLogRow,
  DmsDocumentPermissionRow,
  DmsDocumentRow,
  DmsDocumentReviewRow,
  DmsDocumentVersionRow,
} from "@/types/database";
import type {
  DmsAuditAction,
  DmsDocumentLogRecord,
  DmsDocumentPermissionRecord,
  DmsDocumentRecord,
  DmsDocumentReviewRecord,
  DmsDocumentType,
  DmsDocumentVersionRecord,
  DmsDocumentWithVersionCount,
  DmsPermissionLevel,
  DmsReviewStatus,
} from "@/types/dmsDocuments";

export const DMS_STORAGE_BUCKET = "dms-documents";

function throwErr(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

function docRowToDomain(row: DmsDocumentRow): DmsDocumentRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    documentType: row.document_type as DmsDocumentType,
    clientId: row.client_id,
    projectId: row.project_id,
    currentVersionId: row.current_version_id,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    tags: row.tags ?? [],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    searchText: row.search_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function versionRowToDomain(row: DmsDocumentVersionRow): DmsDocumentVersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNumber: row.version_number,
    storagePath: row.storage_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    comment: row.comment,
    createdByBackofficeUserId: row.created_by_backoffice_user_id,
    createdAt: row.created_at,
  };
}

function permRowToDomain(row: DmsDocumentPermissionRow): DmsDocumentPermissionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    backofficeUserId: row.backoffice_user_id,
    permission: row.permission as DmsPermissionLevel,
    createdAt: row.created_at,
  };
}

function logRowToDomain(row: DmsDocumentLogRow): DmsDocumentLogRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    backofficeUserId: row.backoffice_user_id,
    action: row.action as DmsAuditAction,
    details: (row.details ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function reviewRowToDomain(row: DmsDocumentReviewRow): DmsDocumentReviewRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    assigneeBackofficeUserId: row.assignee_backoffice_user_id,
    assignedByBackofficeUserId: row.assigned_by_backoffice_user_id,
    status: row.status as DmsReviewStatus,
    requestNote: row.request_note,
    workerNote: row.worker_note,
    requestedAt: row.requested_at,
    submittedAt: row.submitted_at,
    approvedByBackofficeUserId: row.approved_by_backoffice_user_id,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    targetVersionId: row.target_version_id,
    updatedAt: row.updated_at,
    taskReadAt: row.task_read_at ?? null,
    taskReviewAt: row.task_review_at ?? null,
    taskValidateAt: row.task_validate_at ?? null,
    taskUploadAt: row.task_upload_at ?? null,
    workerOutcome:
      row.worker_outcome === "OK" || row.worker_outcome === "NOT_OK" ? row.worker_outcome : null,
  };
}

async function insertAuditLog(input: {
  documentId: string;
  backofficeUserId: string;
  action: DmsAuditAction;
  details?: Record<string, unknown>;
}): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("dms_document_logs").insert({
    document_id: input.documentId,
    backoffice_user_id: input.backofficeUserId,
    action: input.action,
    details: input.details ?? {},
  });
  if (error) throwErr(error);
}

async function ensureAssigneesReviewWritePermission(documentId: string, assigneeBackofficeUserIds: string[]): Promise<void> {
  const sb = requireSupabase();
  for (const uid of assigneeBackofficeUserIds) {
    const { data: existing, error: qErr } = await sb
      .from("dms_document_permissions")
      .select("permission")
      .eq("document_id", documentId)
      .eq("backoffice_user_id", uid)
      .maybeSingle();
    if (qErr) throwErr(qErr);
    const p = (existing as { permission?: string } | null)?.permission;
    if (!p) {
      const { error: insErr } = await sb.from("dms_document_permissions").insert({
        document_id: documentId,
        backoffice_user_id: uid,
        permission: "WRITE",
      });
      if (insErr) throwErr(insErr);
    } else if (p === "READ") {
      const { error: upErr } = await sb
        .from("dms_document_permissions")
        .update({ permission: "WRITE" })
        .eq("document_id", documentId)
        .eq("backoffice_user_id", uid);
      if (upErr) throwErr(upErr);
    }
  }
}

export type DmsListFilters = {
  search?: string;
  documentType?: DmsDocumentType | "";
  clientId?: string;
  projectId?: string;
};

export async function listDmsDocuments(filters: DmsListFilters = {}): Promise<DmsDocumentWithVersionCount[]> {
  const sb = requireSupabase();
  let q = sb.from("dms_documents").select("*").order("updated_at", { ascending: false });

  const search = filters.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, " ");
    const pat = `%${esc}%`;
    q = q.or(`name.ilike.${pat},description.ilike.${pat},search_text.ilike.${pat}`);
  }
  if (filters.documentType) {
    q = q.eq("document_type", filters.documentType);
  }
  if (filters.clientId) {
    q = q.eq("client_id", filters.clientId);
  }
  if (filters.projectId) {
    q = q.eq("project_id", filters.projectId);
  }

  const { data, error } = await q;
  if (error) throwErr(error);
  const rows = (data ?? []) as DmsDocumentRow[];
  const ids = rows.map((r) => r.id);
  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: verRows, error: vErr } = await sb
      .from("dms_document_versions")
      .select("document_id")
      .in("document_id", ids);
    if (vErr) throwErr(vErr);
    for (const r of (verRows ?? []) as { document_id: string }[]) {
      countMap.set(r.document_id, (countMap.get(r.document_id) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    ...docRowToDomain(row),
    versionCount: countMap.get(row.id) ?? 0,
  }));
}

export async function getDmsDocument(documentId: string): Promise<DmsDocumentRecord | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("dms_documents").select("*").eq("id", documentId).maybeSingle();
  if (error) throwErr(error);
  if (!data) return null;
  return docRowToDomain(data as DmsDocumentRow);
}

export async function listDmsDocumentVersions(documentId: string): Promise<DmsDocumentVersionRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dms_document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });
  if (error) throwErr(error);
  return ((data ?? []) as DmsDocumentVersionRow[]).map(versionRowToDomain);
}

export async function listDmsDocumentPermissions(documentId: string): Promise<DmsDocumentPermissionRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("dms_document_permissions").select("*").eq("document_id", documentId);
  if (error) throwErr(error);
  return ((data ?? []) as DmsDocumentPermissionRow[]).map(permRowToDomain);
}

export async function listDmsDocumentLogs(documentId: string): Promise<DmsDocumentLogRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dms_document_logs")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throwErr(error);
  return ((data ?? []) as DmsDocumentLogRow[]).map(logRowToDomain);
}

export async function listDmsDocumentReviews(documentId: string): Promise<DmsDocumentReviewRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dms_document_reviews")
    .select("*")
    .eq("document_id", documentId)
    .order("requested_at", { ascending: false });
  if (error) throwErr(error);
  return ((data ?? []) as DmsDocumentReviewRow[]).map(reviewRowToDomain);
}

async function requireAuthBackofficeProfileId(): Promise<string> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) throw new Error("No se encontró el perfil backoffice.");
  return profile.id;
}

/** Revisiones pendientes donde la sesión actual es el trabajador asignado (no requiere módulo DMS). */
export async function listMyDmsDocumentReviewsAsAssignee(): Promise<DmsDocumentReviewRecord[]> {
  const profileId = await requireAuthBackofficeProfileId();
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dms_document_reviews")
    .select("*")
    .eq("assignee_backoffice_user_id", profileId)
    .in("status", ["ASSIGNED", "CHANGES_REQUESTED"])
    .order("requested_at", { ascending: false });
  if (error) throwErr(error);
  return ((data ?? []) as DmsDocumentReviewRow[]).map(reviewRowToDomain);
}

export async function getDmsDocumentReviewByIdForAssignee(reviewId: string): Promise<DmsDocumentReviewRecord | null> {
  const profileId = await requireAuthBackofficeProfileId();
  const sb = requireSupabase();
  const { data, error } = await sb.from("dms_document_reviews").select("*").eq("id", reviewId).maybeSingle();
  if (error) throwErr(error);
  if (!data) return null;
  const row = data as DmsDocumentReviewRow;
  if (row.assignee_backoffice_user_id !== profileId) return null;
  return reviewRowToDomain(row);
}

export async function createDmsDocumentWithInitialVersion(input: {
  name: string;
  description?: string;
  documentType: DmsDocumentType;
  clientId?: string | null;
  projectId?: string | null;
  tags?: string[];
  searchText?: string;
  metadata?: Record<string, unknown>;
  file: File;
  comment?: string;
  actorBackofficeUserId: string;
}): Promise<{ document: DmsDocumentRecord; version: DmsDocumentVersionRecord }> {
  const sb = requireSupabase();

  const { data: docRow, error: dErr } = await sb
    .from("dms_documents")
    .insert({
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      document_type: input.documentType,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      current_version_id: null,
      created_by_backoffice_user_id: input.actorBackofficeUserId,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      search_text: (input.searchText ?? "").trim(),
    })
    .select("*")
    .single();

  if (dErr || !docRow) {
    throwErr(dErr ?? new Error("Insert document failed"));
  }

  const document = docRow as DmsDocumentRow;
  const docId = document.id;

  const versionId = crypto.randomUUID();
  const safe = sanitizeFilename(input.file.name);
  const storagePath = `dms/${docId}/v1_${versionId}_${safe}`;

  const { error: upErr } = await sb.storage.from(DMS_STORAGE_BUCKET).upload(storagePath, input.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) {
    await sb.from("dms_documents").delete().eq("id", docId);
    throwErr(upErr);
  }

  const { data: verRow, error: vErr } = await sb
    .from("dms_document_versions")
    .insert({
      id: versionId,
      document_id: docId,
      version_number: 1,
      storage_path: storagePath,
      file_size: input.file.size,
      mime_type: input.file.type || "application/octet-stream",
      original_filename: input.file.name,
      comment: (input.comment ?? "").trim(),
      created_by_backoffice_user_id: input.actorBackofficeUserId,
    })
    .select("*")
    .single();

  if (vErr || !verRow) {
    await sb.storage.from(DMS_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined);
    await sb.from("dms_documents").delete().eq("id", docId);
    throwErr(vErr ?? new Error("Insert version failed"));
  }

  const version = verRow as DmsDocumentVersionRow;

  const { error: upDocErr } = await sb
    .from("dms_documents")
    .update({ current_version_id: version.id })
    .eq("id", docId);
  if (upDocErr) {
    await sb.from("dms_document_versions").delete().eq("id", version.id);
    await sb.storage.from(DMS_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined);
    await sb.from("dms_documents").delete().eq("id", docId);
    throwErr(upDocErr);
  }

  await insertAuditLog({
    documentId: docId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "CREATE",
    details: {
      name: input.name,
      documentType: input.documentType,
      versionId: version.id,
      storagePath,
    },
  });

  await insertAuditLog({
    documentId: docId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "VERSION_UPLOAD",
    details: { versionNumber: 1, versionId: version.id },
  });

  return {
    document: { ...docRowToDomain(document), currentVersionId: version.id },
    version: versionRowToDomain(version),
  };
}

export async function uploadDmsDocumentVersion(input: {
  documentId: string;
  file: File;
  comment?: string;
  actorBackofficeUserId: string;
}): Promise<DmsDocumentVersionRecord> {
  const sb = requireSupabase();

  const { data: maxRow, error: maxErr } = await sb
    .from("dms_document_versions")
    .select("version_number")
    .eq("document_id", input.documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) throwErr(maxErr);
  const nextNum = (maxRow?.version_number as number | undefined) ? Number(maxRow.version_number) + 1 : 1;

  const versionId = crypto.randomUUID();
  const safe = sanitizeFilename(input.file.name);
  const storagePath = `dms/${input.documentId}/v${nextNum}_${versionId}_${safe}`;

  const { error: upErr } = await sb.storage.from(DMS_STORAGE_BUCKET).upload(storagePath, input.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throwErr(upErr);

  const { data: verRow, error: vErr } = await sb
    .from("dms_document_versions")
    .insert({
      id: versionId,
      document_id: input.documentId,
      version_number: nextNum,
      storage_path: storagePath,
      file_size: input.file.size,
      mime_type: input.file.type || "application/octet-stream",
      original_filename: input.file.name,
      comment: (input.comment ?? "").trim(),
      created_by_backoffice_user_id: input.actorBackofficeUserId,
    })
    .select("*")
    .single();

  if (vErr || !verRow) {
    await sb.storage.from(DMS_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined);
    throwErr(vErr ?? new Error("Insert version failed"));
  }

  const version = verRow as DmsDocumentVersionRow;

  const { error: curErr } = await sb
    .from("dms_documents")
    .update({ current_version_id: version.id })
    .eq("id", input.documentId);
  if (curErr) throwErr(curErr);

  await insertAuditLog({
    documentId: input.documentId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "VERSION_UPLOAD",
    details: { versionNumber: nextNum, versionId: version.id },
  });

  return versionRowToDomain(version);
}

export async function updateDmsDocumentMetadata(
  documentId: string,
  patch: {
    name?: string;
    description?: string;
    documentType?: DmsDocumentType;
    clientId?: string | null;
    projectId?: string | null;
    tags?: string[];
    searchText?: string;
    metadata?: Record<string, unknown>;
  },
  actorBackofficeUserId: string
): Promise<DmsDocumentRecord> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description.trim();
  if (patch.documentType !== undefined) row.document_type = patch.documentType;
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.projectId !== undefined) row.project_id = patch.projectId;
  if (patch.tags !== undefined) row.tags = patch.tags;
  if (patch.searchText !== undefined) row.search_text = patch.searchText.trim();
  if (patch.metadata !== undefined) row.metadata = patch.metadata;

  const { data, error } = await sb.from("dms_documents").update(row).eq("id", documentId).select("*").single();
  if (error) throwErr(error);

  await insertAuditLog({
    documentId,
    backofficeUserId: actorBackofficeUserId,
    action: "UPDATE_METADATA",
    details: patch as Record<string, unknown>,
  });

  return docRowToDomain(data as DmsDocumentRow);
}

export async function setDmsDocumentPermission(input: {
  documentId: string;
  backofficeUserId: string;
  permission: DmsPermissionLevel;
  actorBackofficeUserId: string;
}): Promise<DmsDocumentPermissionRecord> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("dms_document_permissions")
    .upsert(
      {
        document_id: input.documentId,
        backoffice_user_id: input.backofficeUserId,
        permission: input.permission,
      },
      { onConflict: "document_id,backoffice_user_id" }
    )
    .select("*")
    .single();
  if (error) throwErr(error);

  await insertAuditLog({
    documentId: input.documentId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "PERMISSION_GRANT",
    details: { targetUserId: input.backofficeUserId, permission: input.permission },
  });

  return permRowToDomain(data as DmsDocumentPermissionRow);
}

export async function removeDmsDocumentPermission(input: {
  documentId: string;
  backofficeUserId: string;
  actorBackofficeUserId: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("dms_document_permissions")
    .delete()
    .eq("document_id", input.documentId)
    .eq("backoffice_user_id", input.backofficeUserId);
  if (error) throwErr(error);

  await insertAuditLog({
    documentId: input.documentId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "PERMISSION_REVOKE",
    details: { targetUserId: input.backofficeUserId },
  });
}

export async function assignDmsDocumentReview(input: {
  documentId: string;
  assigneeBackofficeUserIds: string[];
  requestNote?: string;
  actorBackofficeUserId: string;
}): Promise<void> {
  const sb = requireSupabase();
  const ids = Array.from(new Set(input.assigneeBackofficeUserIds.map((v) => v.trim()).filter(Boolean)));
  if (ids.length === 0) return;

  await ensureAssigneesReviewWritePermission(input.documentId, ids);

  const doc = await getDmsDocument(input.documentId);
  const docName = doc?.name ?? "Documento";

  const rows = ids.map((assigneeId) => ({
    document_id: input.documentId,
    assignee_backoffice_user_id: assigneeId,
    assigned_by_backoffice_user_id: input.actorBackofficeUserId,
    status: "ASSIGNED" as DmsReviewStatus,
    request_note: (input.requestNote ?? "").trim(),
    worker_note: "",
    submitted_at: null,
    approved_by_backoffice_user_id: null,
    approved_at: null,
    rejection_reason: "",
    task_read_at: null,
    task_review_at: null,
    task_validate_at: null,
    task_upload_at: null,
    worker_outcome: null,
  }));

  const { data: upserted, error } = await sb
    .from("dms_document_reviews")
    .upsert(rows, { onConflict: "document_id,assignee_backoffice_user_id" })
    .select("id, assignee_backoffice_user_id");

  if (error) throwErr(error);

  let pairs = (upserted ?? []) as { id: string; assignee_backoffice_user_id: string }[];
  if (pairs.length === 0) {
    const { data: fetched, error: fErr } = await sb
      .from("dms_document_reviews")
      .select("id, assignee_backoffice_user_id")
      .eq("document_id", input.documentId)
      .in("assignee_backoffice_user_id", ids);
    if (fErr) throwErr(fErr);
    pairs = (fetched ?? []) as { id: string; assignee_backoffice_user_id: string }[];
  }

  const note = (input.requestNote ?? "").trim();
  const body = note
    ? `Se te ha asignado una tarea sobre el documento «${docName}».\n\nInstrucciones:\n${note}\n\nAbre «Mensajes» en el panel o el bloque de documentos pendientes; marca lectura y revisión, indica si está OK o adjunta una nueva versión si no lo está.`
    : `Se te ha asignado una tarea sobre el documento «${docName}». Abre «Mensajes» en el panel o el bloque de documentos pendientes.`;

  for (const p of pairs) {
    await createBackofficeMessage(p.assignee_backoffice_user_id, {
      category: "DMS_DOCUMENT_REVIEW",
      title: `Documento pendiente: ${docName}`,
      body,
      payload: {
        kind: "dms_document_review",
        documentId: input.documentId,
        reviewId: p.id,
      },
    });
  }

  await insertAuditLog({
    documentId: input.documentId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "REVIEW_ASSIGN",
    details: { assigneeCount: ids.length, assigneeIds: ids },
  });
}

export async function submitDmsDocumentReview(input: {
  reviewId: string;
  workerNote?: string;
  outcome: "OK" | "NOT_OK";
  newVersionFile?: File | null;
  actorBackofficeUserId: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { data: rev, error: rErr } = await sb.from("dms_document_reviews").select("*").eq("id", input.reviewId).single();
  if (rErr) throwErr(rErr);
  const row = rev as DmsDocumentReviewRow;

  if (row.assignee_backoffice_user_id !== input.actorBackofficeUserId) {
    throw new Error("Solo el trabajador asignado puede enviar esta tarea.");
  }
  if (row.status !== "ASSIGNED" && row.status !== "CHANGES_REQUESTED") {
    throw new Error("Esta tarea ya fue enviada o cerrada.");
  }
  if (!row.task_read_at || !row.task_review_at) {
    throw new Error("Marca como hechas la lectura y la revisión antes de enviar.");
  }

  const note = (input.workerNote ?? "").trim();

  if (input.outcome === "OK") {
    const { error } = await sb
      .from("dms_document_reviews")
      .update({
        status: "SUBMITTED",
        worker_outcome: "OK",
        worker_note: note,
        submitted_at: new Date().toISOString(),
        approved_by_backoffice_user_id: null,
        approved_at: null,
        rejection_reason: "",
      })
      .eq("id", input.reviewId);
    if (error) throwErr(error);
  } else {
    if (!note) {
      throw new Error("Escribe un comentario indicando qué debe corregirse.");
    }
    if (!input.newVersionFile) {
      throw new Error("Adjunta el fichero de la nueva versión del documento.");
    }
    await uploadDmsDocumentVersion({
      documentId: row.document_id,
      file: input.newVersionFile,
      comment: note,
      actorBackofficeUserId: input.actorBackofficeUserId,
    });
    const { error } = await sb
      .from("dms_document_reviews")
      .update({
        status: "SUBMITTED",
        worker_outcome: "NOT_OK",
        worker_note: note,
        submitted_at: new Date().toISOString(),
        approved_by_backoffice_user_id: null,
        approved_at: null,
        rejection_reason: "",
      })
      .eq("id", input.reviewId);
    if (error) throwErr(error);
  }

  await insertAuditLog({
    documentId: row.document_id,
    backofficeUserId: input.actorBackofficeUserId,
    action: "REVIEW_SUBMIT",
    details: { reviewId: input.reviewId, outcome: input.outcome },
  });
}

export async function resolveDmsDocumentReview(input: {
  reviewId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
  rejectionReason?: string;
  actorBackofficeUserId: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { data: row, error: rErr } = await sb
    .from("dms_document_reviews")
    .select("document_id")
    .eq("id", input.reviewId)
    .single();
  if (rErr) throwErr(rErr);

  const patch =
    input.status === "APPROVED"
      ? {
          status: "APPROVED" as DmsReviewStatus,
          approved_by_backoffice_user_id: input.actorBackofficeUserId,
          approved_at: new Date().toISOString(),
          rejection_reason: "",
        }
      : {
          status: "CHANGES_REQUESTED" as DmsReviewStatus,
          approved_by_backoffice_user_id: input.actorBackofficeUserId,
          approved_at: new Date().toISOString(),
          rejection_reason: (input.rejectionReason ?? "").trim(),
          task_read_at: null,
          task_review_at: null,
          task_validate_at: null,
          task_upload_at: null,
          worker_outcome: null,
        };

  const { error } = await sb.from("dms_document_reviews").update(patch).eq("id", input.reviewId);
  if (error) throwErr(error);

  await insertAuditLog({
    documentId: (row as { document_id: string }).document_id,
    backofficeUserId: input.actorBackofficeUserId,
    action: input.status === "APPROVED" ? "REVIEW_APPROVE" : "REVIEW_CHANGES_REQUESTED",
    details: {
      reviewId: input.reviewId,
      reason: input.status === "CHANGES_REQUESTED" ? (input.rejectionReason ?? "").trim() : "",
    },
  });
}

export async function updateDmsReviewTaskPhases(input: {
  reviewId: string;
  patch: { read?: boolean; review?: boolean };
  actorBackofficeUserId: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { data: rev, error: rErr } = await sb
    .from("dms_document_reviews")
    .select("assignee_backoffice_user_id, status, document_id")
    .eq("id", input.reviewId)
    .single();
  if (rErr) throwErr(rErr);
  const st = (rev as { status: string }).status;
  if (st !== "ASSIGNED" && st !== "CHANGES_REQUESTED") {
    throw new Error("Esta tarea ya no admite cambios en las fases.");
  }
  if ((rev as { assignee_backoffice_user_id: string }).assignee_backoffice_user_id !== input.actorBackofficeUserId) {
    throw new Error("Solo el trabajador asignado puede marcar las fases.");
  }

  const nowIso = new Date().toISOString();
  const row: Record<string, unknown> = {};
  const p = input.patch;
  if (p.read !== undefined) row.task_read_at = p.read ? nowIso : null;
  if (p.review !== undefined) row.task_review_at = p.review ? nowIso : null;

  if (Object.keys(row).length === 0) return;

  const { error } = await sb.from("dms_document_reviews").update(row).eq("id", input.reviewId);
  if (error) throwErr(error);
}

export async function getDmsVersionSignedUrl(
  versionId: string,
  options?: { expiresSec?: number; logDownload?: boolean; actorBackofficeUserId?: string; documentId?: string }
): Promise<string> {
  const sb = requireSupabase();
  const { data: ver, error: vErr } = await sb
    .from("dms_document_versions")
    .select("storage_path, document_id")
    .eq("id", versionId)
    .single();
  if (vErr) throwErr(vErr);

  const path = (ver as DmsDocumentVersionRow).storage_path;
  const docId = options?.documentId ?? (ver as { document_id: string }).document_id;

  const { data, error } = await sb.storage
    .from(DMS_STORAGE_BUCKET)
    .createSignedUrl(path, options?.expiresSec ?? 3600);
  if (error) throwErr(error);

  if (options?.logDownload && options.actorBackofficeUserId) {
    await insertAuditLog({
      documentId: docId,
      backofficeUserId: options.actorBackofficeUserId,
      action: "DOWNLOAD",
      details: { versionId },
    });
  }

  return data.signedUrl;
}

export async function deleteDmsDocument(input: { documentId: string; actorBackofficeUserId: string }): Promise<void> {
  const sb = requireSupabase();
  const { data: doc, error: d0 } = await sb.from("dms_documents").select("name").eq("id", input.documentId).single();
  if (d0) throwErr(d0);

  const { data: versions, error: vErr } = await sb
    .from("dms_document_versions")
    .select("storage_path")
    .eq("document_id", input.documentId);
  if (vErr) throwErr(vErr);
  const paths = ((versions ?? []) as { storage_path: string }[]).map((v) => v.storage_path).filter(Boolean);

  await insertAuditLog({
    documentId: input.documentId,
    backofficeUserId: input.actorBackofficeUserId,
    action: "DELETE",
    details: { name: (doc as { name: string }).name, pathsCount: paths.length },
  });

  const { error: delErr } = await sb.from("dms_documents").delete().eq("id", input.documentId);
  if (delErr) throwErr(delErr);

  if (paths.length > 0) {
    await sb.storage.from(DMS_STORAGE_BUCKET).remove(paths).catch(() => undefined);
  }
}

/** Clave estable para react-query a partir de filtros de listado. */
export function dmsListFiltersKey(filters: DmsListFilters): string {
  return JSON.stringify({
    s: filters.search ?? "",
    t: filters.documentType ?? "",
    c: filters.clientId ?? "",
    p: filters.projectId ?? "",
  });
}
