export type WorkerVacationChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerVacationChangeRequestRecord {
  id: string;
  companyWorkerId: string;
  backofficeUserId: string;
  calendarYear: number;
  status: WorkerVacationChangeStatus;
  workerMessage: string;
  proposedDates: string[];
  previousApprovedDates: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
