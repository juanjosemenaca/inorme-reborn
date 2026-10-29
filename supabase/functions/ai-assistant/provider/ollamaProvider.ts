import { ProviderError } from "./errors.ts";
import { toFunctionToolJson, type AIChatRequest, type AIChatResponse, type AIMessage, type AIProvider, type AIToolCall } from "./types.ts";

/**
 * Adapter para Ollama `/api/chat` (no streaming).
 * Campos según docs.ollama.com/api/chat y docs.ollama.com/capabilities/tool-calling:
 * - tools: [{ type: "function", function: { name, description, parameters } }]
 * - assistant.tool_calls[].function.arguments es un **objeto**, no un string
 * - resultado: { role: "tool", tool_name, content }
 * - structured: `format` = "json" o un JSON Schema
 * - capacidades: POST /api/show → `capabilities` (p. ej. "tools")
 */

type OllamaToolCall = {
  type?: string;
  id?: string;
  function?: { index?: number; name?: string; arguments?: unknown };
};

type OllamaChatMessage = {
  role: string;
  content?: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
};

function toOllamaMessages(messages: AIMessage[]): OllamaChatMessage[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_name: m.name, content: m.content };
    }
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.tool_calls?.map((c) => ({
          type: "function",
          function: { name: c.name, arguments: c.arguments ?? {} },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function parseToolCalls(raw: OllamaToolCall[] | undefined): AIToolCall[] {
  if (!raw?.length) return [];
  return raw.map((c, i) => {
    const name = c.function?.name ?? "";
    let args: unknown = c.function?.arguments ?? {};
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        args = {};
      }
    }
    return { id: c.id || `ollama-${name || "tool"}-${i}`, name, arguments: args };
  });
}

export type OllamaHealthStatus =
  | "ready"
  | "unreachable"
  | "model_missing"
  | "tools_unsupported"
  | "timeout"
  | "http_error";

export type OllamaHealthResult = {
  ok: boolean;
  status: OllamaHealthStatus;
  model: string;
  tools: "yes" | "no" | "unknown";
  elapsedMs: number;
  httpStatus?: number;
  capabilities?: string[];
};

export type OllamaProviderOptions = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export class OllamaProvider implements AIProvider {
  readonly name = "ollama" as const;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private toolsSupport: boolean | null = null;

  constructor(opts: OllamaProviderOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs;
    this.maxTokens = opts.maxTokens;
    this.apiKey = opts.apiKey ?? "";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  /**
   * Comprobación de disponibilidad. No forma parte de `AIProvider` y no se expone al frontend:
   * ningún campo incluye `OLLAMA_BASE_URL`. Todavía no hay ruta HTTP; el corte a producción
   * podrá llamarla desde `ai-assistant` (nunca desde React → Ollama).
   */
  async healthCheck(): Promise<OllamaHealthResult> {
    const started = Date.now();
    const model = this.model;
    const done = (row: Omit<OllamaHealthResult, "model" | "elapsedMs" | "ok">): OllamaHealthResult => ({
      ok: row.status === "ready",
      model,
      elapsedMs: Date.now() - started,
      ...row,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/show`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ model, name: model }),
        signal: controller.signal,
      });
      const text = await res.text().catch(() => "");
      if (res.status === 404 || /not found|file does not exist/i.test(text)) {
        return done({ status: "model_missing", tools: "unknown", httpStatus: res.status });
      }
      if (!res.ok) {
        return done({ status: "http_error", tools: "unknown", httpStatus: res.status });
      }
      let json: { capabilities?: unknown };
      try {
        json = JSON.parse(text) as { capabilities?: unknown };
      } catch {
        return done({ status: "http_error", tools: "unknown", httpStatus: res.status });
      }
      if (Array.isArray(json.capabilities)) {
        const capabilities = json.capabilities.map(String);
        const tools = capabilities.includes("tools");
        return done({
          status: tools ? "ready" : "tools_unsupported",
          tools: tools ? "yes" : "no",
          httpStatus: res.status,
          capabilities,
        });
      }
      return done({ status: "ready", tools: "unknown", httpStatus: res.status });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return done({ status: "timeout", tools: "unknown" });
      }
      return done({ status: "unreachable", tools: "unknown" });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Consulta `/api/show`. Si el campo `capabilities` existe y no incluye `tools`, devolvemos false.
   * Si no hay `capabilities` (Ollama antiguo), no afirmamos soporte: `chat()` fallará con error claro.
   */
  async supportsToolCalling(): Promise<boolean> {
    if (this.toolsSupport !== null) return this.toolsSupport;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/show`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ model: this.model, name: this.model }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("ollama_show_error", res.status, text.slice(0, 300));
        this.toolsSupport = null;
        return true;
      }
      const json = (await res.json()) as { capabilities?: unknown };
      if (Array.isArray(json.capabilities)) {
        this.toolsSupport = json.capabilities.map(String).includes("tools");
        return this.toolsSupport;
      }
      this.toolsSupport = null;
      return true;
    } catch (e) {
      console.error("ollama_show_network", e instanceof Error ? e.message : String(e));
      throw new ProviderError("provider_error", 502, "ollama");
    }
  }

  supportsStructuredOutput(): boolean {
    return true;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const wantsTools = (request.tools ?? []).length > 0;
    if (wantsTools) {
      const ok = await this.supportsToolCalling();
      if (ok === false) {
        throw new ProviderError("provider_tools_unsupported", 400, "ollama");
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOllamaMessages(request.messages),
      stream: false,
      // gpt-oss reserva tokens en `thinking` y a menudo deja `content` vacío.
      think: request.think ?? false,
      options: {
        temperature: request.temperature ?? 0.2,
        num_predict: request.maxTokens ?? this.maxTokens,
      },
    };
    if (wantsTools) body.tools = (request.tools ?? []).map(toFunctionToolJson);
    if (request.structured) body.format = request.structured.schema;

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        console.error("ollama_http_error", res.status, text.slice(0, 500));
        if (/does not support tools/i.test(text)) {
          this.toolsSupport = false;
          throw new ProviderError("provider_tools_unsupported", res.status, "ollama");
        }
        throw new ProviderError("provider_error", res.status || 502, "ollama");
      }
      let json: { message?: OllamaChatMessage; prompt_eval_count?: number; eval_count?: number };
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        throw new ProviderError("provider_error", 502, "ollama");
      }
      const msg = json.message ?? { role: "assistant", content: "" };
      const calls = parseToolCalls(msg.tool_calls);
      const prompt = json.prompt_eval_count;
      const completion = json.eval_count;
      return {
        content: (msg.content ?? "").trim() ? msg.content! : null,
        tool_calls: calls,
        usage:
          prompt != null || completion != null
            ? {
                prompt_tokens: prompt,
                completion_tokens: completion,
                total_tokens: (prompt ?? 0) + (completion ?? 0),
              }
            : undefined,
      };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (e instanceof Error && e.name === "AbortError") throw new ProviderError("provider_timeout", 504, "ollama");
      console.error("ollama_network_error", e instanceof Error ? e.message : String(e));
      throw new ProviderError("provider_error", 502, "ollama");
    } finally {
      clearTimeout(timer);
    }
  }
}
