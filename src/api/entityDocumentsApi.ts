import { PROJECT_DOCUMENTS_BUCKET } from "@/api/projectsApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type { EntityDocumentRow } from "@/types/database";
import type { EntityDocumentKind, EntityDocumentOwnerType, EntityDocumentRecord } from "@/types/entityDocuments";

function throwErr(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

function rowKind(row: EntityDocumentRow): EntityDocumentKind {
  return row.kind === "CV" ? "CV" : "OTHER";
}

function rowToDomain(row: EntityDocumentRow): EntityDocumentRecord {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    kind: rowKind(row),
    createdAt: row.created_at,
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function fetchEntityDocuments(
  ownerType: EntityDocumentOwnerType,
  ownerId: string
): Promise<EntityDocumentRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("entity_documents")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throwErr(error);
  return ((data ?? []) as EntityDocumentRow[]).map(rowToDomain);
}

export async function uploadEntityDocument(input: {
  ownerType: EntityDocumentOwnerType;
  ownerId: string;
  file: File;
  /** Solo aplica a `COMPANY_WORKER`; en otros dueños se fuerza `OTHER`. */
  kind?: EntityDocumentKind;
}): Promise<EntityDocumentRecord> {
  const sb = requireSupabase();
  const docId = crypto.randomUUID();
  const safe = sanitizeFilename(input.file.name);
  const storagePath = `entity-documents/${input.ownerType}/${input.ownerId}/${docId}_${safe}`;
  const kind: EntityDocumentKind =
    input.ownerType === "COMPANY_WORKER" ? (input.kind ?? "OTHER") : "OTHER";
  const { error: upErr } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(storagePath, input.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throwErr(upErr);

  const { data, error } = await sb
    .from("entity_documents")
    .insert({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      storage_path: storagePath,
      original_filename: input.file.name,
      file_size: input.file.size,
      mime_type: input.file.type || "application/octet-stream",
      kind,
    })
    .select("*")
    .single();
  if (error) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([storagePath]).catch(() => undefined);
    throwErr(error);
  }
  return rowToDomain(data as EntityDocumentRow);
}

export async function deleteEntityDocument(doc: EntityDocumentRecord): Promise<void> {
  const sb = requireSupabase();
  const { error: delErr } = await sb.from("entity_documents").delete().eq("id", doc.id);
  if (delErr) throwErr(delErr);
  await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([doc.storagePath]).catch(() => undefined);
}

export async function getEntityDocumentSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).createSignedUrl(storagePath, expiresSec);
  if (error) throwErr(error);
  return data.signedUrl;
}

const CV_PRESENCE_CHUNK = 120;

/**
 * Trabajadores (`company_workers.id`) que tienen al menos un adjunto marcado como CV.
 */
export async function fetchCompanyWorkerIdsHavingCv(workerIds: string[]): Promise<Set<string>> {
  const sb = requireSupabase();
  const unique = [...new Set(workerIds)];
  const out = new Set<string>();
  for (let i = 0; i < unique.length; i += CV_PRESENCE_CHUNK) {
    const slice = unique.slice(i, i + CV_PRESENCE_CHUNK);
    const { data, error } = await sb
      .from("entity_documents")
      .select("owner_id")
      .eq("owner_type", "COMPANY_WORKER")
      .eq("kind", "CV")
      .in("owner_id", slice);
    if (error) throwErr(error);
    for (const row of (data ?? []) as { owner_id: string }[]) {
      out.add(row.owner_id);
    }
  }
  return out;
}
