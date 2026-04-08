import type { BackofficeUserRecord } from "@/types/backoffice";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";

/**
 * Un trabajador puede recibir alta de usuario si está activo y no hay ya cuenta
 * vinculada por ficha ni por el mismo email de acceso.
 */
export function isWorkerEligibleForNewBackofficeUser(
  w: CompanyWorkerRecord,
  users: BackofficeUserRecord[]
): boolean {
  if (!w.active) return false;
  if (users.some((u) => u.companyWorkerId === w.id)) return false;
  const email = w.email.trim().toLowerCase();
  if (email && users.some((u) => u.email.trim().toLowerCase() === email)) return false;
  return true;
}

/**
 * Trabajadores que pueden vincularse al editar un usuario (excluye la fila que se está editando).
 */
export function isWorkerEligibleForBackofficeUserEdit(
  w: CompanyWorkerRecord,
  users: BackofficeUserRecord[],
  editingUserId: string
): boolean {
  if (!w.active) return false;
  const others = users.filter((u) => u.id !== editingUserId);
  if (others.some((u) => u.companyWorkerId === w.id)) return false;
  const email = w.email.trim().toLowerCase();
  if (email && others.some((u) => u.email.trim().toLowerCase() === email)) return false;
  return true;
}
