/** Tipos de documento DMS (CHECK en `dms_documents.document_type`). */
export type DmsDocumentType =
  | "CONTRACT"
  | "INVOICE"
  | "REPORT"
  | "CORRESPONDENCE"
  | "CERTIFICATE"
  | "PLEADING"
  | "OTHER";

export type DmsPermissionLevel = "READ" | "WRITE" | "ADMIN";

export type DmsAuditAction =
  | "CREATE"
  | "UPDATE_METADATA"
  | "VERSION_UPLOAD"
  | "DOWNLOAD"
  | "DELETE"
  | "PERMISSION_GRANT"
  | "PERMISSION_REVOKE"
  | "REVIEW_ASSIGN"
  | "REVIEW_SUBMIT"
  | "REVIEW_APPROVE"
  | "REVIEW_CHANGES_REQUESTED";

export type DmsReviewStatus = "ASSIGNED" | "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED";

export interface DmsDocumentRecord {
  id: string;
  name: string;
  description: string;
  documentType: DmsDocumentType;
  clientId: string | null;
  projectId: string | null;
  currentVersionId: string | null;
  createdByBackofficeUserId: string;
  tags: string[];
  metadata: Record<string, unknown>;
  searchText: string;
  createdAt: string;
  updatedAt: string;
}

export interface DmsDocumentVersionRecord {
  id: string;
  documentId: string;
  versionNumber: number;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  originalFilename: string;
  comment: string;
  createdByBackofficeUserId: string | null;
  createdAt: string;
}

export interface DmsDocumentPermissionRecord {
  id: string;
  documentId: string;
  backofficeUserId: string;
  permission: DmsPermissionLevel;
  createdAt: string;
}

export interface DmsDocumentLogRecord {
  id: string;
  documentId: string | null;
  backofficeUserId: string | null;
  action: DmsAuditAction;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface DmsDocumentReviewRecord {
  id: string;
  documentId: string;
  assigneeBackofficeUserId: string;
  assignedByBackofficeUserId: string;
  status: DmsReviewStatus;
  requestNote: string;
  workerNote: string;
  requestedAt: string;
  submittedAt: string | null;
  approvedByBackofficeUserId: string | null;
  approvedAt: string | null;
  rejectionReason: string;
  targetVersionId: string | null;
  updatedAt: string;
  /** Marca temporal al completar la fase «Leer» (null = pendiente). */
  taskReadAt: string | null;
  taskReviewAt: string | null;
  taskValidateAt: string | null;
  taskUploadAt: string | null;
  /** Tras enviar: el trabajador acepta el documento o indica que hay que corregirlo. */
  workerOutcome: "OK" | "NOT_OK" | null;
}

export interface DmsDocumentWithVersionCount extends DmsDocumentRecord {
  versionCount: number;
}
