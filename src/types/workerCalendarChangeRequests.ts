export type WorkerCalendarChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerCalendarChangeRequestRecord {
  id: string;
  companyWorkerId: string;
  backofficeUserId: string;
  status: WorkerCalendarChangeStatus;
  workerMessage: string;
  previousSiteId: string;
  suggestedSiteId: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
