import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "./errors.ts";
import { MockAIProvider } from "./mockProvider.ts";
import { OllamaProvider } from "./ollamaProvider.ts";
import { OpenAIProvider } from "./openaiProvider.ts";

describe("OpenAIProvider", () => {
  it("envía Chat Completions con tools y parsea tool_calls", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.tools[0].function.name).toBe("get_billing_summary");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer sk-test" });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: { name: "get_billing_summary", arguments: '{"start_date":"2026-10-01"}' },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const p = new OpenAIProvider({ apiKey: "sk-test", model: "gpt-4o-mini", timeoutMs: 5000, maxTokens: 100, fetchImpl });
    expect(p.supportsToolCalling()).toBe(true);
    const res = await p.chat({
      messages: [{ role: "user", content: "facturación" }],
      tools: [{ name: "get_billing_summary", description: "x", parameters: { type: "object" } }],
    });
    expect(res.tool_calls[0]).toEqual({
      id: "call_1",
      name: "get_billing_summary",
      arguments: { start_date: "2026-10-01" },
    });
    expect(res.usage?.total_tokens).toBe(15);
  });

  it("mapea 429 de saldo a openai_quota", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: "insufficient_quota" } }), { status: 429 })
    ) as unknown as typeof fetch;
    const p = new OpenAIProvider({ apiKey: "sk-test", model: "gpt-4o-mini", timeoutMs: 5000, maxTokens: 100, fetchImpl });
    await expect(p.chat({ messages: [{ role: "user", content: "hola" }] })).rejects.toMatchObject({
      code: "openai_quota",
    });
  });
});

describe("OllamaProvider", () => {
  it("usa /api/chat en OLLAMA_BASE_URL, no OpenAI", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/api/show")) {
        return new Response(JSON.stringify({ capabilities: ["completion", "tools"] }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.think).toBe(false);
      return new Response(
        JSON.stringify({
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ function: { name: "get_clients_summary", arguments: {} } }],
          },
          prompt_eval_count: 3,
          eval_count: 2,
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const p = new OllamaProvider({
      baseUrl: "https://mi-servidor-ai.example.com",
      model: "qwen3.5",
      timeoutMs: 5000,
      maxTokens: 100,
      fetchImpl,
    });
    expect(await p.supportsToolCalling()).toBe(true);
    const res = await p.chat({
      messages: [{ role: "user", content: "clientes" }],
      tools: [{ name: "get_clients_summary", description: "x", parameters: { type: "object" } }],
    });
    expect(urls.every((u) => u.startsWith("https://mi-servidor-ai.example.com"))).toBe(true);
    expect(urls.some((u) => u.includes("openai.com"))).toBe(false);
    expect(res.tool_calls[0].name).toBe("get_clients_summary");
  });

  it("si el modelo no tiene capability tools, error claro (no SQL)", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/show")) {
        return new Response(JSON.stringify({ capabilities: ["completion"] }), { status: 200 });
      }
      throw new Error("no debería llamar a /api/chat");
    }) as unknown as typeof fetch;
    const p = new OllamaProvider({
      baseUrl: "https://ai.example",
      model: "tiny",
      timeoutMs: 5000,
      maxTokens: 50,
      fetchImpl,
    });
    await expect(
      p.chat({
        messages: [{ role: "user", content: "facturación" }],
        tools: [{ name: "get_billing_summary", description: "x", parameters: { type: "object" } }],
      })
    ).rejects.toBeInstanceOf(ProviderError);
    await expect(
      p.chat({
        messages: [{ role: "user", content: "facturación" }],
        tools: [{ name: "get_billing_summary", description: "x", parameters: { type: "object" } }],
      })
    ).rejects.toMatchObject({ code: "provider_tools_unsupported" });
  });

  it("healthCheck distingue ready / sin tools / modelo inexistente / HTTP / red / timeout", async () => {
    const cases: Array<{
      fetchImpl: typeof fetch;
      status: string;
      tools: string;
      ok: boolean;
    }> = [
      {
        fetchImpl: vi.fn(async () => new Response(JSON.stringify({ capabilities: ["completion", "tools"] }), { status: 200 })) as unknown as typeof fetch,
        status: "ready",
        tools: "yes",
        ok: true,
      },
      {
        fetchImpl: vi.fn(async () => new Response(JSON.stringify({ capabilities: ["completion"] }), { status: 200 })) as unknown as typeof fetch,
        status: "tools_unsupported",
        tools: "no",
        ok: false,
      },
      {
        fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: "model 'nope' not found" }), { status: 404 })) as unknown as typeof fetch,
        status: "model_missing",
        tools: "unknown",
        ok: false,
      },
      {
        fetchImpl: vi.fn(async () => new Response("upstream failed", { status: 502 })) as unknown as typeof fetch,
        status: "http_error",
        tools: "unknown",
        ok: false,
      },
      {
        fetchImpl: vi.fn(async () => {
          throw new Error("connection refused");
        }) as unknown as typeof fetch,
        status: "unreachable",
        tools: "unknown",
        ok: false,
      },
    ];
    for (const c of cases) {
      const p = new OllamaProvider({
        baseUrl: "https://ai.example",
        model: "qwen3:8b",
        timeoutMs: 5000,
        maxTokens: 50,
        fetchImpl: c.fetchImpl,
      });
      const h = await p.healthCheck();
      expect(h).toMatchObject({ status: c.status, tools: c.tools, ok: c.ok, model: "qwen3:8b" });
      expect(JSON.stringify(h)).not.toContain("ai.example");
    }

    const abortFetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
    const slow = new OllamaProvider({
      baseUrl: "https://ai.example",
      model: "qwen3:8b",
      timeoutMs: 20,
      maxTokens: 50,
      fetchImpl: abortFetch,
    });
    await expect(slow.healthCheck()).resolves.toMatchObject({ status: "timeout", ok: false, model: "qwen3:8b" });
  });

  it("un error de Ollama no dispara fetch a OpenAI", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;
    const p = new OllamaProvider({
      baseUrl: "https://ai.example",
      model: "qwen3.5",
      timeoutMs: 5000,
      maxTokens: 50,
      fetchImpl,
    });
    await expect(p.chat({ messages: [{ role: "user", content: "hola" }] })).rejects.toMatchObject({
      code: "provider_error",
      provider: "ollama",
    });
    const called = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(called.every((u) => u.includes("ai.example"))).toBe(true);
  });
});

describe("MockAIProvider", () => {
  it("el dashboard builder usa herramientas estructuradas (sin SQL)", async () => {
    const p = new MockAIProvider();
    const tools = [
      { name: "propose_dashboard_layout", description: "x", parameters: { type: "object" } },
      { name: "create_dashboard_widget", description: "x", parameters: { type: "object" } },
      { name: "delete_dashboard_widget", description: "x", parameters: { type: "object" } },
    ];
    const res = await p.chat({
      messages: [{ role: "user", content: "Quiero un panel para controlar la facturación. Pon arriba tres KPIs." }],
      tools,
    });
    expect(res.tool_calls[0]?.name).toBe("propose_dashboard_layout");
    const del = await p.chat({
      messages: [{ role: "user", content: "Quita las facturas vencidas." }],
      tools,
    });
    expect(del.tool_calls[0]?.name).toBe("delete_dashboard_widget");
    expect(del.tool_calls[0]?.arguments).toMatchObject({ title_query: "vencid" });
  });

  it("no usa fetch y puede invocar herramientas", async () => {
    const p = new MockAIProvider();
    const res = await p.chat({
      messages: [{ role: "user", content: "Analiza la facturación" }],
      tools: [{ name: "get_billing_summary", description: "x", parameters: { type: "object" } }],
    });
    expect(res.tool_calls[0]?.name).toBe("get_billing_summary");
    const follow = await p.chat({
      messages: [
        { role: "user", content: "Analiza la facturación" },
        { role: "assistant", content: null, tool_calls: res.tool_calls },
        { role: "tool", tool_call_id: res.tool_calls[0].id, name: "get_billing_summary", content: "{}" },
      ],
      tools: [{ name: "get_billing_summary", description: "x", parameters: { type: "object" } }],
    });
    expect(follow.content).toMatch(/mock/i);
    expect(follow.tool_calls).toEqual([]);
  });
});
