import type { WorkerModuleKey } from "@/types/backoffice";

export type WorkerModuleChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerModuleChangeRequestRecord {
  id: string;
  companyWorkerId: string;
  backofficeUserId: string;
  status: WorkerModuleChangeStatus;
  workerMessage: string;
  previousModules: WorkerModuleKey[];
  suggestedModules: WorkerModuleKey[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
