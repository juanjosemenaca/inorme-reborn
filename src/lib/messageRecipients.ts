import type { BackofficeUserRecord } from "@/types/backoffice";
import type { ProjectWithDocuments } from "@/types/projects";
import { getDisplayName } from "@/types/backoffice";

/** Usuarios backoffice activos a los que puede escribir un trabajador (excluye solo a sí mismo). */
export function eligibleWorkerMessageRecipients(
  users: BackofficeUserRecord[],
  myBackofficeUserId: string
): BackofficeUserRecord[] {
  return users.filter((u) => u.active && u.id !== myBackofficeUserId);
}

/** Proyectos en los que el trabajador de plantilla está asignado (responsable o miembro del equipo). */
export function projectsWhereCompanyWorkerParticipates(
  projects: ProjectWithDocuments[],
  companyWorkerId: string | null | undefined
): ProjectWithDocuments[] {
  if (!companyWorkerId) return [];
  return projects.filter((p) => {
    if (p.responsibleCompanyWorkerId === companyWorkerId) return true;
    return p.members.some((m) => m.companyWorkerId === companyWorkerId);
  });
}

/** Resuelve cuenta(s) backoffice del responsable y del equipo del proyecto. */
export function backofficeUserIdsForProjectTeam(
  project: ProjectWithDocuments,
  users: BackofficeUserRecord[],
  myBackofficeUserId: string
): string[] {
  const cwIds = new Set<string>();
  if (project.responsibleCompanyWorkerId) cwIds.add(project.responsibleCompanyWorkerId);
  for (const m of project.members) cwIds.add(m.companyWorkerId);
  const out = new Set<string>();
  for (const u of users) {
    if (!u.active || !u.companyWorkerId) continue;
    if (u.id === myBackofficeUserId) continue;
    if (cwIds.has(u.companyWorkerId)) out.add(u.id);
  }
  return [...out];
}

export function formatUserOptionLabel(u: BackofficeUserRecord): string {
  const name = getDisplayName(u)?.trim();
  if (name) return `${name} (${u.email})`;
  return u.email;
}
