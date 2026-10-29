/**
 * Tipos del Asistente IA. Mantener alineados con
 * `supabase/functions/ai-assistant/report.ts` e `index.ts`.
 */

export type AiReportKpi = {
  label: string;
  value: string;
  variation?: string;
};

export type AiReportSection = {
  title: string;
  content: string;
};

export type AiReportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type AiReport = {
  title: string;
  period?: string;
  summary: string;
  kpis: AiReportKpi[];
  sections: AiReportSection[];
  tables?: AiReportTable[];
};

export type AiChartType = "pie" | "column" | "bar" | "line";
export type AiChartUnit = "eur" | "count" | "percent";

export type AiChartSeries = {
  name: string;
  values: number[];
};

export type AiChart = {
  type: AiChartType;
  title: string;
  period?: string;
  unit: AiChartUnit;
  categories: string[];
  series: AiChartSeries[];
};

export type AiMessageRole = "user" | "assistant";

export type AiMessageModel = {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
  report?: AiReport | null;
  charts?: AiChart[];
  toolsUsed?: string[];
  /** Mensaje del asistente aún en curso (sin contenido). */
  pending?: boolean;
  /** Error al obtener la respuesta (se muestra en la burbuja). */
  error?: string | null;
};

export type AiConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AiChatResponse = {
  conversationId: string;
  reply: string;
  report: AiReport | null;
  charts: AiChart[];
  toolsUsed: string[];
};

/** Filas Postgres de `ai_conversations` / `ai_messages`. */
export interface AiConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiMessageRow {
  id: string;
  conversation_id: string;
  role: AiMessageRole;
  content: string;
  metadata: { report?: AiReport | null; charts?: AiChart[]; tools_used?: string[] } | null;
  created_at: string;
}
