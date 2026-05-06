import { requireSupabase } from "@/api/supabaseRequire";
import { sortByLocaleKey } from "@/lib/sortAlpha";
import { getErrorMessage } from "@/lib/errorMessage";
import {
  projectDocumentRowToDomain,
  projectMemberRowToDomain,
  projectRowToDomain,
} from "@/lib/supabase/mappers";
import type { ProjectDocumentRow, ProjectMemberRow, ProjectRow } from "@/types/database";
import type { ClientRecord } from "@/types/clients";
import type {
  ProjectDocumentRecord,
  ProjectMemberRecord,
  ProjectMemberRole,
  ProjectRecord,
  ProjectWithDocuments,
} from "@/types/projects";

/** Bucket Storage (crear en Supabase: Storage → New bucket → privado). */
export const PROJECT_DOCUMENTS_BUCKET = "project-documents";

function throwSupabaseError(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

/** Si aún no está aplicada la migración 20260423150000_project_members_rpc.sql. */
function isLikelyMissingProjectMembersRpcError(err: unknown): boolean {
  const m = getErrorMessage(err).toLowerCase();
  return (
    m.includes("list_project_members_for_ids") ||
    m.includes("sync_project_members")
  ) && (m.includes("does not exist") || m.includes("not found") || m.includes("unknown"));
}

function isProjectMembersSchemaCacheError(err: unknown): boolean {
  const m = getErrorMessage(err).toLowerCase();
  return m.includes("project_members") && m.includes("schema cache");
}

function isMissingProjectsColumnError(err: unknown, column: string): boolean {
  const m = getErrorMessage(err).toLowerCase();
  if (m.includes("schema cache")) return false;
  const col = column.toLowerCase();
  if (!m.includes(col)) return false;
  const looksLikeUndefinedColumn =
    m.includes("does not exist") || m.includes("undefined column") || m.includes("42703");
  if (!looksLikeUndefinedColumn) return false;
  return (
    m.includes("projects") || m.includes('relation "projects"') || m.includes("insert into projects")
  );
}

function toNullableId(s: string | null | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

/** Reglas de negocio: cliente final del proyecto solo si el contratante es intermediario. */
export function validateProjectFinalClient(
  client: ClientRecord | undefined,
  finalClientIdRaw: string | null | undefined,
  allClients: ClientRecord[]
): string | null {
  const finalClientId = toNullableId(finalClientIdRaw);
  if (!client) throw new Error("El cliente seleccionado no existe.");
  if (client.clientKind === "FINAL") {
    if (finalClientId) {
      throw new Error("Un proyecto con cliente final como contratante no debe vincular otro cliente final.");
    }
    return null;
  }
  if (!finalClientId) return null;
  if (finalClientId === client.id) {
    throw new Error("El cliente final no puede ser el mismo que el cliente contratante.");
  }
  const target = allClients.find((c) => c.id === finalClientId);
  if (!target) throw new Error("El cliente final seleccionado no existe.");
  if (target.clientKind !== "FINAL") {
    throw new Error("Solo puedes vincular un cliente con tipo «cliente final».");
  }
  return finalClientId;
}

export async function fetchProjectsWithDocuments(): Promise<ProjectWithDocuments[]> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throwSupabaseError(error);
  const projects = (rows ?? []) as ProjectRow[];
  if (projects.length === 0) return [];
  const ids = projects.map((p) => p.id);
  const { data: docRows, error: dErr } = await sb.from("project_documents").select("*").in("project_id", ids);
  if (dErr) throwSupabaseError(dErr);
  const rpcMem = await sb.rpc("list_project_members_for_ids", { p_project_ids: ids });
  let memRows: ProjectMemberRow[] = [];
  if (rpcMem.error) {
    if (isLikelyMissingProjectMembersRpcError(rpcMem.error)) {
      const fb = await sb.from("project_members").select("*").in("project_id", ids);
      if (fb.error) {
        // Fallback de compatibilidad: si PostgREST no ve project_members, no romper listado.
        if (isProjectMembersSchemaCacheError(fb.error)) {
          memRows = [];
        } else {
          throwSupabaseError(fb.error);
        }
      } else {
        memRows = (fb.data ?? []) as ProjectMemberRow[];
      }
    } else {
      throwSupabaseError(rpcMem.error);
    }
  } else {
    const memJson = rpcMem.data;
    memRows = Array.isArray(memJson)
      ? (memJson as ProjectMemberRow[])
      : ((memJson as unknown as ProjectMemberRow[] | null) ?? []);
  }
  const byProject = new Map<string, ProjectDocumentRecord[]>();
  for (const dr of (docRows ?? []) as ProjectDocumentRow[]) {
    const d = projectDocumentRowToDomain(dr);
    const list = byProject.get(d.projectId) ?? [];
    list.push(d);
    byProject.set(d.projectId, list);
  }
  const byMembers = new Map<string, ProjectMemberRecord[]>();
  for (const mr of memRows as ProjectMemberRow[]) {
    const m = projectMemberRowToDomain(mr);
    const list = byMembers.get(m.projectId) ?? [];
    list.push(m);
    byMembers.set(m.projectId, list);
  }
  const list = projects.map((row) => ({
    ...projectRowToDomain(row),
    documents: byProject.get(row.id) ?? [],
    members: byMembers.get(row.id) ?? [],
  }));
  return sortByLocaleKey(list, (p) => p.title);
}

export type ProjectMemberInput = { companyWorkerId: string; role: ProjectMemberRole };

/** Sustituye el equipo del proyecto (mismo trabajador no puede repetirse). */
export async function syncProjectMembers(projectId: string, assignments: ProjectMemberInput[]): Promise<void> {
  const sb = requireSupabase();
  const seen = new Set<string>();
  for (const a of assignments) {
    if (!a.companyWorkerId.trim()) continue;
    if (seen.has(a.companyWorkerId)) {
      throw new Error("No puede haber el mismo trabajador duplicado en el equipo del proyecto.");
    }
    seen.add(a.companyWorkerId);
  }
  const valid = assignments.filter((a) => a.companyWorkerId.trim());
  const payload = valid.map((a) => ({
    company_worker_id: a.companyWorkerId,
    role: a.role,
  }));
  const rpc = await sb.rpc("sync_project_members", {
    p_project_id: projectId,
    p_members: payload,
  });
  if (rpc.error) {
    if (isLikelyMissingProjectMembersRpcError(rpc.error)) {
      const { error: delErr } = await sb.from("project_members").delete().eq("project_id", projectId);
      if (delErr) {
        // Permite guardar proyecto aunque project_members no esté visible en cache REST.
        if (isProjectMembersSchemaCacheError(delErr)) return;
        throwSupabaseError(delErr);
      }
      if (payload.length === 0) return;
      const rows = payload.map((a) => ({
        project_id: projectId,
        company_worker_id: a.company_worker_id,
        role: a.role,
      }));
      const { error: insErr } = await sb.from("project_members").insert(rows);
      if (insErr) {
        if (isProjectMembersSchemaCacheError(insErr)) return;
        throwSupabaseError(insErr);
      }
      return;
    }
    throwSupabaseError(rpc.error);
  }
}

export type SaveProjectInput = {
  title: string;
  description: string;
  clientId: string;
  finalClientId: string | null;
  startDate: string;
  endDate: string;
  responsibleCompanyWorkerId: string;
  /** Si null, el aviso se programa con la regla de 2 meses antes del fin. */
  endNoticeAt: string | null;
};

function normalizeDateOnly(s: string): string {
  return s.trim();
}

export async function createProject(input: SaveProjectInput, allClients: ClientRecord[]): Promise<ProjectRecord> {
  const sb = requireSupabase();
  const client = allClients.find((c) => c.id === input.clientId);
  const finalId = validateProjectFinalClient(client, input.finalClientId, allClients);
  const rid = input.responsibleCompanyWorkerId.trim();
  if (!rid) throw new Error("Debes indicar un responsable de proyecto.");
  const startD = normalizeDateOnly(input.startDate);
  const endD = normalizeDateOnly(input.endDate);
  if (!startD || !endD) throw new Error("Las fechas de inicio y de fin del proyecto son obligatorias.");
  const notice = input.endNoticeAt?.trim() || null;
  const insert = {
    title: input.title.trim(),
    description: input.description.trim(),
    client_id: input.clientId,
    final_client_id: finalId,
    start_date: startD,
    end_date: endD,
    responsible_company_worker_id: rid,
    end_notice_at: notice,
    end_notice_message_sent_at: null,
  };
  const firstTry = await sb.from("projects").insert(insert).select("*").single();
  if (!firstTry.error) return projectRowToDomain(firstTry.data as ProjectRow);

  // Compatibilidad local: permite guardar aunque falten columnas de la migracion reciente.
  if (
    isMissingProjectsColumnError(firstTry.error, "responsible_company_worker_id") ||
    isMissingProjectsColumnError(firstTry.error, "end_notice_at") ||
    isMissingProjectsColumnError(firstTry.error, "end_notice_message_sent_at")
  ) {
    const legacyInsert = {
      title: input.title.trim(),
      description: input.description.trim(),
      client_id: input.clientId,
      final_client_id: finalId,
      start_date: startD,
      end_date: endD,
    };
    const legacyTry = await sb.from("projects").insert(legacyInsert).select("*").single();
    if (legacyTry.error) throwSupabaseError(legacyTry.error);
    return projectRowToDomain(legacyTry.data as ProjectRow);
  }

  throwSupabaseError(firstTry.error);
}

export async function updateProject(
  id: string,
  input: SaveProjectInput,
  allClients: ClientRecord[]
): Promise<ProjectRecord> {
  const sb = requireSupabase();
  const prevRes = await sb
    .from("projects")
    .select("end_date, end_notice_at, responsible_company_worker_id, end_notice_message_sent_at")
    .eq("id", id)
    .maybeSingle();
  let prev = prevRes.data as
    | {
        end_date: string;
        end_notice_at: string | null;
        responsible_company_worker_id: string | null;
      }
    | null;
  if (prevRes.error) {
    if (
      isMissingProjectsColumnError(prevRes.error, "end_notice_at") ||
      isMissingProjectsColumnError(prevRes.error, "responsible_company_worker_id")
    ) {
      const basePrev = await sb.from("projects").select("end_date").eq("id", id).maybeSingle();
      if (basePrev.error) throwSupabaseError(basePrev.error);
      prev = basePrev.data
        ? ({
            end_date: (basePrev.data as { end_date: string }).end_date,
            end_notice_at: null,
            responsible_company_worker_id: null,
          } as const)
        : null;
    } else {
      throwSupabaseError(prevRes.error);
    }
  }

  const client = allClients.find((c) => c.id === input.clientId);
  const finalId = validateProjectFinalClient(client, input.finalClientId, allClients);
  const rid = input.responsibleCompanyWorkerId.trim();
  if (!rid) throw new Error("Debes indicar un responsable de proyecto.");
  const startD = normalizeDateOnly(input.startDate);
  const endD = normalizeDateOnly(input.endDate);
  if (!startD || !endD) throw new Error("Las fechas de inicio y de fin del proyecto son obligatorias.");
  const notice = input.endNoticeAt?.trim() || null;

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description.trim(),
    client_id: input.clientId,
    final_client_id: finalId,
    start_date: startD,
    end_date: endD,
    responsible_company_worker_id: rid,
    end_notice_at: notice,
  };
  if (prev) {
    const prevNotice = (prev as { end_notice_at: string | null }).end_notice_at;
    const prevRid = (prev as { responsible_company_worker_id: string | null }).responsible_company_worker_id;
    const prevEnd = (prev as { end_date: string }).end_date;
    if (
      prevEnd !== endD ||
      (prevNotice ?? null) !== (notice ?? null) ||
      (prevRid ?? null) !== rid
    ) {
      patch.end_notice_message_sent_at = null;
    }
  }
  const updateTry = await sb.from("projects").update(patch).eq("id", id).select("*").single();
  if (!updateTry.error) return projectRowToDomain(updateTry.data as ProjectRow);

  if (
    isMissingProjectsColumnError(updateTry.error, "responsible_company_worker_id") ||
    isMissingProjectsColumnError(updateTry.error, "end_notice_at") ||
    isMissingProjectsColumnError(updateTry.error, "end_notice_message_sent_at")
  ) {
    const legacyPatch = {
      title: input.title.trim(),
      description: input.description.trim(),
      client_id: input.clientId,
      final_client_id: finalId,
      start_date: startD,
      end_date: endD,
    };
    const legacyTry = await sb.from("projects").update(legacyPatch).eq("id", id).select("*").single();
    if (legacyTry.error) throwSupabaseError(legacyTry.error);
    return projectRowToDomain(legacyTry.data as ProjectRow);
  }

  throwSupabaseError(updateTry.error);
}

/** Ejecuta avisos de fin de proyecto para el día actual (Europa/Madrid). Idempotente en BD. */
export async function runProjectEndNotices(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("send_project_end_notices");
  if (error) throwSupabaseError(error);
  return typeof data === "number" ? data : Number(data) || 0;
}

async function removeStorageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const sb = requireSupabase();
  const { error } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove(paths);
  if (error) throwSupabaseError(error);
}

export async function deleteProject(id: string): Promise<void> {
  const sb = requireSupabase();
  const { data: docs, error: dErr } = await sb.from("project_documents").select("storage_path").eq("project_id", id);
  if (dErr) throwSupabaseError(dErr);
  const paths = (docs ?? []).map((r: { storage_path: string }) => r.storage_path);
  await removeStorageFiles(paths);
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) throwSupabaseError(error);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function uploadProjectDocument(projectId: string, file: File): Promise<ProjectDocumentRecord> {
  const sb = requireSupabase();
  const docId = crypto.randomUUID();
  const safe = sanitizeFilename(file.name);
  const storagePath = `projects/${projectId}/${docId}_${safe}`;
  const { error: upErr } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throwSupabaseError(upErr);
  const { data: row, error } = await sb
    .from("project_documents")
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
    })
    .select("*")
    .single();
  if (error) {
    await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([storagePath]);
    throwSupabaseError(error);
  }
  return projectDocumentRowToDomain(row as ProjectDocumentRow);
}

export async function deleteProjectDocument(doc: ProjectDocumentRecord): Promise<void> {
  const sb = requireSupabase();
  const { error: sErr } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([doc.storagePath]);
  if (sErr) throwSupabaseError(sErr);
  const { error } = await sb.from("project_documents").delete().eq("id", doc.id);
  if (error) throwSupabaseError(error);
}

export async function getProjectDocumentSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.storage.from(PROJECT_DOCUMENTS_BUCKET).createSignedUrl(storagePath, expiresSec);
  if (error) throwSupabaseError(error);
  return data.signedUrl;
}
