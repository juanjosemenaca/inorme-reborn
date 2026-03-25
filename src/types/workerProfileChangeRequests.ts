/** Datos personales que un trabajador puede solicitar modificar (sin contrato/calendario). */
export type WorkerPersonalDataSuggestion = {
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  mobile: string;
  postalAddress: string;
  city: string;
};

export type WorkerProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerProfileChangeRequestRecord {
  id: string;
  companyWorkerId: string;
  backofficeUserId: string;
  status: WorkerProfileChangeStatus;
  workerMessage: string;
  suggested: WorkerPersonalDataSuggestion;
  previousSnapshot: WorkerPersonalDataSuggestion | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
