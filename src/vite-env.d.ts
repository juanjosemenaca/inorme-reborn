/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Base URL del API de facturas masivas (opcional; si falta, se usa el proxy de Vite en desarrollo). */
  readonly VITE_BULK_INVOICE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
