/** Mensajes de ejemplo; en producción vendrían de API */
export interface MockBackofficeMessage {
  id: string;
  subject: string;
  fromEmail: string;
  bodyPreview: string;
  date: string;
  /** Si coincide con el id del trabajador, lo ve como “suyo”; null = solo admin o sin asignar */
  assignedToUserId: string | null;
}

export const MOCK_MESSAGES: MockBackofficeMessage[] = [
  {
    id: "m1",
    subject: "Consulta proyecto core",
    fromEmail: "cliente@banco.es",
    bodyPreview: "Nos gustaría información sobre implantación...",
    date: "2025-02-01",
    assignedToUserId: "u-worker-seed",
  },
  {
    id: "m2",
    subject: "Soporte técnico",
    fromEmail: "soporte@empresa.com",
    bodyPreview: "Incidencia en el módulo de reporting...",
    date: "2025-02-03",
    assignedToUserId: null,
  },
  {
    id: "m3",
    subject: "Reunión seguimiento",
    fromEmail: "director@seguros.es",
    bodyPreview: "Propongo reunión la próxima semana...",
    date: "2025-02-05",
    assignedToUserId: "u-worker-seed",
  },
];
