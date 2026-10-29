import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { AiPrincipal } from "../permissions.ts";
import type { AIFunctionToolJson, AIToolSpec } from "../provider/types.ts";

export type ToolContext = {
  principal: AiPrincipal;
  /** Cliente con el JWT del usuario: RLS se aplica como en la aplicación. */
  db: SupabaseClient;
  /** Hoy (Europe/Madrid) en formato ISO. */
  today: string;
};

export type AiTool = {
  /** Spec interna o JSON `{ type: function }` (OpenAI/Ollama). El orquestador normaliza. */
  definition: AIToolSpec | AIFunctionToolJson;
  /** Valida `rawArgs` (Zod) y ejecuta consultas conocidas. Lanza `ToolError` en fallos controlados. */
  run: (ctx: ToolContext, rawArgs: unknown) => Promise<unknown>;
};

/** Error controlado: `code` corto para auditoría; `userMessage` legible para el modelo/usuario. */
export class ToolError extends Error {
  code: string;
  constructor(code: string, userMessage: string) {
    super(userMessage);
    this.code = code;
  }
}

/** Convierte errores de PostgREST en ToolError sin filtrar detalles al cliente. */
export function dbFail(context: string, error: { message?: string; code?: string } | null): never {
  console.error("ai_tool_db_error", context, error?.code, error?.message);
  throw new ToolError("db_error", "No se han podido consultar los datos. Inténtalo de nuevo.");
}

export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Límite duro de filas leídas por consulta para acotar coste y memoria. */
export const MAX_ROWS = 5000;

/** JSON Schema común para rangos de fechas. */
export const DATE_PARAM = { type: "string", description: "Fecha ISO YYYY-MM-DD." } as const;
