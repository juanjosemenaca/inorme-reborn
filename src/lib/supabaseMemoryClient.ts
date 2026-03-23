import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente sin persistir sesión en localStorage. Sirve para `signUp` de otro usuario
 * sin sustituir la sesión del administrador.
 */
export function createMemorySupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== "string" || !url || typeof key !== "string" || !key) {
    throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.");
  }
  const memory = {
    getItem: () => null as string | null,
    setItem: () => {},
    removeItem: () => {},
  };
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storage: memory,
    },
  });
}
