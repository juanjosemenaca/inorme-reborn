export type EntityDocumentOwnerType = "COMPANY_WORKER" | "CLIENT" | "PROVIDER";

export type EntityDocumentKind = "CV" | "OTHER";

export interface EntityDocumentRecord {
  id: string;
  ownerType: EntityDocumentOwnerType;
  ownerId: string;
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  kind: EntityDocumentKind;
  createdAt: string;
}
