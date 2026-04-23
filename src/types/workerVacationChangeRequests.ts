import type { VacationDayEntry } from "@/types/vacationDays";

export type WorkerVacationChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerVacationChangeRequestRecord {
  id: string;
  companyWorkerId: string;
  backofficeUserId: string;
  calendarYear: number;
  status: WorkerVacationChangeStatus;
  workerMessage: string;
  /** ISO fechas (normal + traspaso); para difs de permisos. */
  proposedDates: string[];
  previousApprovedDates: string[];
  proposedEntries: VacationDayEntry[];
  previousApprovedEntries: VacationDayEntry[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
