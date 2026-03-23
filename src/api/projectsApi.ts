import { requireSupabase } from "@/api/supabaseRequire";
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
  const { data: memRows, error: mErr } = await sb.from("project_members").select("*").in("project_id", ids);
  if (mErr) throwSupabaseError(mErr);
  const byProject = new Map<string, ProjectDocumentRecord[]>();
  for (const dr of (docRows ?? []) as ProjectDocumentRow[]) {
    const d = projectDocumentRowToDomain(dr);
    const list = byProject.get(d.projectId) ?? [];
    list.push(d);
    byProject.set(d.projectId, list);
  }
  const byMembers = new Map<string, ProjectMemberRecord[]>();
  for (const mr of (memRows ?? []) as ProjectMemberRow[]) {
    const m = projectMemberRowToDomain(mr);
    const list = byMembers.get(m.projectId) ?? [];
    list.push(m);
    byMembers.set(m.projectId, list);
  }
  return projects.map((row) => ({
    ...projectRowToDomain(row),
    documents: byProject.get(row.id) ?? [],
    members: byMembers.get(row.id) ?? [],
  }));
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
  const { error: delErr } = await sb.from("project_members").delete().eq("project_id", projectId);
  if (delErr) throwSupabaseError(delErr);
  if (valid.length === 0) return;
  const rows = valid.map((a) => ({
    project_id: projectId,
    company_worker_id: a.companyWorkerId,
    role: a.role,
  }));
  const { error: insErr } = await sb.from("project_members").insert(rows);
  if (insErr) throwSupabaseError(insErr);
}

export type SaveProjectInput = {
  title: string;
  description: string;
  clientId: string;
  finalClientId: string | null;
  startDate: string | null;
  endDate: string | null;
};

export async function createProject(input: SaveProjectInput, allClients: ClientRecord[]): Promise<ProjectRecord> {
  const sb = requireSupabase();
  const client = allClients.find((c) => c.id === input.clientId);
  const finalId = validateProjectFinalClient(client, input.finalClientId, allClients);
  const insert = {
    title: input.title.trim(),
    description: input.description.trim(),
    client_id: input.clientId,
    final_client_id: finalId,
    start_date: input.startDate,
    end_date: input.endDate,
  };
  const { data: inserted, error } = await sb.from("projects").insert(insert).select("*").single();
  if (error) throwSupabaseError(error);
  return projectRowToDomain(inserted as ProjectRow);
}

export async function updateProject(
  id: string,
  input: SaveProjectInput,
  allClients: ClientRecord[]
): Promise<ProjectRecord> {
  const sb = requireSupabase();
  const client = allClients.find((c) => c.id === input.clientId);
  const finalId = validateProjectFinalClient(client, input.finalClientId, allClients);
  const patch = {
    title: input.title.trim(),
    description: input.description.trim(),
    client_id: input.clientId,
    final_client_id: finalId,
    start_date: input.startDate,
    end_date: input.endDate,
  };
  const { data: updated, error } = await sb.from("projects").update(patch).eq("id", id).select("*").single();
  if (error) throwSupabaseError(error);
  return projectRowToDomain(updated as ProjectRow);
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
