/** Rutas públicas de documentación legal (LSSI / RGPD). */
export const LEGAL_PATHS = {
  notice: "/aviso-legal",
  privacy: "/politica-privacidad",
  cookies: "/politica-cookies",
} as const;

export type LegalDocumentId = keyof typeof LEGAL_PATHS;
