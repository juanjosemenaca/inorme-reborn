/**
 * Contrato interno de IA. Independiente de OpenAI, Ollama u otro proveedor.
 * Los adapters convierten estos tipos al JSON de cada API.
 */

export type JsonSchema = Record<string, unknown>;

export type AIProviderName = "openai" | "ollama" | "mock";

/** Especificación de herramienta que conoce Inorme (no el proveedor). */
export type AIToolSpec = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

/**
 * Forma `{ type: "function", function: { name, description, parameters } }`
 * que coinciden OpenAI Chat Completions y Ollama `/api/chat`.
 * Solo la usan los adapters; el orquestador trabaja con `AIToolSpec`.
 */
export type AIFunctionToolJson = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

export type AIToolCall = {
  id: string;
  name: string;
  /** Argumentos ya parseados (objeto). Nunca un string JSON crudo en este contrato. */
  arguments: unknown;
};

export type AIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AIToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

/**
 * Salida estructurada (informes, futuros widgets/dashboards).
 * Cada provider la traduce a su mecanismo (`response_format`, `format`, etc.).
 * No todos los modelos lo soportan igual: el adapter puede devolver `structured_not_supported`.
 */
export type AIStructuredOutputSpec = {
  name: string;
  description?: string;
  schema: JsonSchema;
};

export type AIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type AIChatRequest = {
  messages: AIMessage[];
  tools?: AIToolSpec[];
  structured?: AIStructuredOutputSpec;
  temperature?: number;
  maxTokens?: number;
  /**
   * Solo Ollama (gpt-oss y similares). `false` evita que el razonamiento interno
   * consuma el cupo y deje la respuesta al usuario vacía. OpenAI lo ignora.
   */
  think?: boolean;
};

export type AIChatResponse = {
  content: string | null;
  tool_calls: AIToolCall[];
  usage?: AIUsage;
  finish_reason?: string;
};

export type AIProvider = {
  readonly name: AIProviderName;
  readonly model: string;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  supportsToolCalling(): boolean | Promise<boolean>;
  supportsStructuredOutput(): boolean | Promise<boolean>;
};

export function toFunctionToolJson(spec: AIToolSpec): AIFunctionToolJson {
  return {
    type: "function",
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
    },
  };
}

export function specFromFunctionJson(json: AIFunctionToolJson): AIToolSpec {
  return {
    name: json.function.name,
    description: json.function.description,
    parameters: json.function.parameters,
  };
}

export function isFunctionToolJson(v: unknown): v is AIFunctionToolJson {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as AIFunctionToolJson).type === "function" &&
    typeof (v as AIFunctionToolJson).function?.name === "string"
  );
}
