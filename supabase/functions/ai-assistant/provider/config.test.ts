import { describe, expect, it } from "vitest";
import { assertProviderConfigured, destinationForLogs, loadAiConfig } from "./config.ts";
import { createProvider } from "./createProvider.ts";
import { ProviderError } from "./errors.ts";
import { MockAIProvider } from "./mockProvider.ts";
import { OllamaProvider } from "./ollamaProvider.ts";
import { OpenAIProvider } from "./openaiProvider.ts";

describe("loadAiConfig", () => {
  it("por defecto usa OpenAI (compatibilidad)", () => {
    const cfg = loadAiConfig({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o-mini" });
    expect(cfg.provider).toBe("openai");
    expect(cfg.openai.model).toBe("gpt-4o-mini");
  });

  it("AI_PROVIDER cambia el proveedor", () => {
    expect(loadAiConfig({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "https://ai.example", OLLAMA_MODEL: "qwen3.5" }).provider).toBe(
      "ollama"
    );
    expect(loadAiConfig({ AI_PROVIDER: "MOCK" }).provider).toBe("mock");
  });

  it("AI_FALLBACK_PROVIDER no se lee ni activa otro proveedor", () => {
    const cfg = loadAiConfig({
      AI_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "https://ai.example",
      OLLAMA_MODEL: "qwen3.5",
      AI_FALLBACK_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-should-not-be-used",
    });
    expect(cfg.provider).toBe("ollama");
    const p = createProvider(cfg);
    expect(p).toBeInstanceOf(OllamaProvider);
    expect(p).not.toBeInstanceOf(OpenAIProvider);
  });
});

describe("createProvider", () => {
  it("openai → OpenAIProvider", () => {
    const p = createProvider(loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-x" }));
    expect(p).toBeInstanceOf(OpenAIProvider);
    expect(p.name).toBe("openai");
  });

  it("ollama → OllamaProvider", () => {
    const p = createProvider(
      loadAiConfig({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "https://host", OLLAMA_MODEL: "qwen3.5" })
    );
    expect(p).toBeInstanceOf(OllamaProvider);
    expect(p.model).toBe("qwen3.5");
  });

  it("mock → MockAIProvider", () => {
    expect(createProvider(loadAiConfig({ AI_PROVIDER: "mock" }))).toBeInstanceOf(MockAIProvider);
  });
});

describe("assertProviderConfigured", () => {
  it("falla OpenAI sin API key", () => {
    expect(() => assertProviderConfigured(loadAiConfig({ AI_PROVIDER: "openai" }))).toThrow(ProviderError);
  });

  it("falla Ollama sin URL o modelo", () => {
    expect(() =>
      assertProviderConfigured(loadAiConfig({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "https://x" }))
    ).toThrow(ProviderError);
  });

  it("mock no exige secretos", () => {
    expect(() => assertProviderConfigured(loadAiConfig({ AI_PROVIDER: "mock" }))).not.toThrow();
  });
});

describe("privacidad de destino", () => {
  it("con ollama el destino documentado no es api.openai.com", () => {
    const cfg = loadAiConfig({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "https://mi-ollama.interno", OLLAMA_MODEL: "qwen3.5" });
    expect(destinationForLogs(cfg)).toBe("https://mi-ollama.interno");
    expect(destinationForLogs(cfg)).not.toContain("openai");
  });
});
