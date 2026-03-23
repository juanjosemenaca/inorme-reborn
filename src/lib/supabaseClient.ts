import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cliente de Supabase (solo si `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están definidos).
 * Los stores del backoffice siguen usando `localStorage` hasta que migres a tablas + RLS.
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
