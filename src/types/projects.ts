/** Proyecto de negocio vinculado a un cliente (y opcionalmente a un cliente final si el contratante es intermediario). */
export interface ProjectRecord {
  id: string;
  /** Código único identificativo (ej. PRJ-000123). */
  projectCode: string;
  title: string;
  description: string;
  clientId: string;
  /** Solo si el cliente contratante es intermediario: destinatario final del proyecto (opcional). */
  finalClientId: string | null;
  startDate: string;
  endDate: string;
  /** Trabajador responsable; obligatorio en formulario de alta/edición. */
  responsibleCompanyWorkerId: string | null;
  /**
   * Día de envío del aviso de fin (personalizado). Si null, se usa la fecha 2 meses antes de `endDate`.
   */
  endNoticeAt: string | null;
  /** Cuando ya se entregó el aviso en el buzón. */
  endNoticeMessageSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Documento almacenado en Storage y referenciado en BD. */
export interface ProjectDocumentRecord {
  id: string;
  projectId: string;
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

/** Rol del trabajador dentro de un proyecto (no confundir con rol backoffice). */
export type ProjectMemberRole =
  | "CONSULTOR"
  | "ANALISTA_FUNCIONAL"
  | "ANALISTA_PROGRAMADOR"
  | "PROGRAMADOR"
  | "JEFE_DE_EQUIPO"
  | "ADMINISTRATIVA"
  | "CONTABLE"
  | "CONTROLER";

export const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = [
  "CONSULTOR",
  "ANALISTA_FUNCIONAL",
  "ANALISTA_PROGRAMADOR",
  "PROGRAMADOR",
  "JEFE_DE_EQUIPO",
  "ADMINISTRATIVA",
  "CONTABLE",
  "CONTROLER",
];

/** Asignación de trabajador de plantilla a un proyecto con rol. */
export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  companyWorkerId: string;
  role: ProjectMemberRole;
  createdAt: string;
}

/** Proyecto con adjuntos y equipo (p. ej. listado admin). */
export interface ProjectWithDocuments extends ProjectRecord {
  documents: ProjectDocumentRecord[];
  members: ProjectMemberRecord[];
}
