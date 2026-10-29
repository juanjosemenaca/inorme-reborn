import type { AiRuntimeConfig } from "./config.ts";
import { ProviderError } from "./errors.ts";
import { MockAIProvider } from "./mockProvider.ts";
import { OllamaProvider } from "./ollamaProvider.ts";
import { OpenAIProvider } from "./openaiProvider.ts";
import type { AIProvider } from "./types.ts";

/**
 * Instancia **solo** el proveedor configurado.
 * Nunca construye OpenAI cuando eligieron Ollama (ni al revés): no hay fallback de coste.
 */
export function createProvider(cfg: AiRuntimeConfig, fetchImpl?: typeof fetch): AIProvider {
  if (cfg.provider === "mock") return new MockAIProvider();
  if (cfg.provider === "openai") {
    return new OpenAIProvider({
      apiKey: cfg.openai.apiKey,
      model: cfg.openai.model,
      timeoutMs: cfg.timeoutMs,
      maxTokens: cfg.maxTokens,
      fetchImpl,
    });
  }
  if (cfg.provider === "ollama") {
    return new OllamaProvider({
      baseUrl: cfg.ollama.baseUrl,
      model: cfg.ollama.model,
      timeoutMs: cfg.timeoutMs,
      maxTokens: cfg.maxTokens,
      apiKey: cfg.ollama.apiKey,
      fetchImpl,
    });
  }
  throw new ProviderError("provider_unknown", 500, String(cfg.provider));
}
