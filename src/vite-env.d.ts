/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** `INORME` (defecto) o `ATTIS` — ver `docs/BACKOFFICE_ATTIS.md`. */
  readonly VITE_BACKOFFICE_PRODUCT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
