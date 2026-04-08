export type WorkerAgendaItemType = "reminder" | "event" | "meeting" | "other" | "admin_note";

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
  createdAt: string;
  updatedAt: string;
}

export const WORKER_AGENDA_ITEM_TYPES: WorkerAgendaItemType[] = [
  "reminder",
  "event",
  "meeting",
  "other",
  "admin_note",
];
