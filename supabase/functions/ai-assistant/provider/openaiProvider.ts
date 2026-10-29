import { ProviderError } from "./errors.ts";
import { toFunctionToolJson, type AIChatRequest, type AIChatResponse, type AIMessage, type AIProvider, type AIToolCall } from "./types.ts";

type OpenAiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function toOpenAiMessages(messages: AIMessage[]): OpenAiMessage[] {
  return messages.map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.tool_calls?.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments ?? {}) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function parseArgs(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  fetchImpl?: typeof fetch;
};

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAIProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs;
    this.maxTokens = opts.maxTokens;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  supportsToolCalling(): boolean {
    return true;
  }

  supportsStructuredOutput(): boolean {
    return true;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const tools = (request.tools ?? []).map(toFunctionToolJson);
    const body: Record<string, unknown> = {
      model: this.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? this.maxTokens,
      messages: toOpenAiMessages(request.messages),
    };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    if (request.structured) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: request.structured.name,
          description: request.structured.description,
          schema: request.structured.schema,
          strict: false,
        },
      };
    }
    try {
      const res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("openai_http_error", res.status, text.slice(0, 500));
        if (res.status === 429) {
          const quota = /insufficient_quota|credit_balance_exhausted/i.test(text);
          throw new ProviderError(quota ? "openai_quota" : "openai_rate_limited", res.status, "openai");
        }
        throw new ProviderError("openai_error", res.status, "openai");
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: OpenAiToolCall[] }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const choice = json.choices?.[0];
      if (!choice) throw new ProviderError("openai_error", 502, "openai");
      const calls: AIToolCall[] = (choice.message?.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: parseArgs(c.function.arguments),
      }));
      return {
        content: choice.message?.content ?? null,
        tool_calls: calls,
        usage: json.usage,
        finish_reason: choice.finish_reason,
      };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (e instanceof Error && e.name === "AbortError") throw new ProviderError("openai_timeout", 504, "openai");
      console.error("openai_network_error", e instanceof Error ? e.message : String(e));
      throw new ProviderError("openai_error", 502, "openai");
    } finally {
      clearTimeout(timer);
    }
  }
}
