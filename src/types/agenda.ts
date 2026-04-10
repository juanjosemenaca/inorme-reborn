export type WorkerAgendaItemType =
  | "reminder"
  | "event"
  | "meeting"
  | "other"
  | "admin_note"
  | "comment"
  | "note"
  | "todo";

export type WorkerAgendaItemSource = "WORKER" | "ADMIN";

export interface WorkerAgendaItemRecord {
  id: string;
  companyWorkerId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  itemType: WorkerAgendaItemType;
  source: WorkerAgendaItemSource;
  createdByBackofficeUserId: string | null;
  /** To-do creado por admin y marcado hecho por el trabajador */
  completedAt: string | null;
  completedByBackofficeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Entradas que el trabajador puede crear él mismo */
export const WORKER_AGENDA_ITEM_TYPES: WorkerAgendaItemType[] = [
  "reminder",
  "event",
  "meeting",
  "other",
];

/** Entradas que el administrador puede añadir en la agenda de un trabajador */
export const ADMIN_WORKER_AGENDA_CREATE_TYPES: WorkerAgendaItemType[] = [
  "comment",
  "note",
  "meeting",
  "event",
  "todo",
  "reminder",
  "other",
  "admin_note",
];
