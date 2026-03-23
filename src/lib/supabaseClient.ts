import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cliente de Supabase (solo si `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están definidos).
 * El backoffice usa Postgres + Supabase Auth (ver `src/api/*`).
 */
export const supabase: SupabaseClient | null =
  typeof url === "string" &&
  url.length > 0 &&
  typeof anonKey === "string" &&
  anonKey.length > 0
    ? createClient(url, anonKey)
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/** Variables que faltan o están vacías (útil para mensajes en UI). */
export function getMissingSupabaseEnvVars(): string[] {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const missing: string[] = [];
  if (typeof url !== "string" || !url.trim()) missing.push("VITE_SUPABASE_URL");
  if (typeof key !== "string" || !key.trim()) missing.push("VITE_SUPABASE_ANON_KEY");
  return missing;
}
