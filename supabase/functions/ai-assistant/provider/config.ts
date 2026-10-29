import type { AIProviderName } from "./types.ts";
import { ProviderError } from "./errors.ts";

export type EnvMap = Record<string, string | undefined>;

export type AiRuntimeConfig = {
  provider: AIProviderName;
  timeoutMs: number;
  maxTokens: number;
  openai: { apiKey: string; model: string };
  ollama: { baseUrl: string; model: string; apiKey: string };
};

const PROVIDERS: readonly AIProviderName[] = ["openai", "ollama", "mock"];

function readName(raw: string | undefined): AIProviderName {
  const v = (raw ?? "openai").trim().toLowerCase();
  if ((PROVIDERS as readonly string[]).includes(v)) return v as AIProviderName;
  throw new ProviderError("provider_unknown", 500, v);
}

/**
 * Lee configuración desde un mapa (Deno.env en producción, objeto en tests).
 * No hay fallback entre proveedores: si `AI_PROVIDER=ollama` falla, no se llama a OpenAI.
 * `AI_FALLBACK_PROVIDER` se ignora a propósito (coste inesperado).
 */
export function loadAiConfig(env: EnvMap): AiRuntimeConfig {
  const provider = readName(env.AI_PROVIDER);
  const timeoutMs = Number(env.AI_TIMEOUT_MS || "25000") || 25_000;
  const maxTokens = Number(env.AI_MAX_TOKENS || "1400") || 1400;
  return {
    provider,
    timeoutMs,
    maxTokens,
    openai: {
      apiKey: (env.OPENAI_API_KEY ?? "").trim(),
      model: (env.OPENAI_MODEL || "gpt-4o-mini").trim(),
    },
    ollama: {
      baseUrl: (env.OLLAMA_BASE_URL ?? "").trim().replace(/\/+$/, ""),
      model: (env.OLLAMA_MODEL ?? "").trim(),
      apiKey: (env.OLLAMA_API_KEY ?? "").trim(),
    },
  };
}

export function assertProviderConfigured(cfg: AiRuntimeConfig): void {
  if (cfg.provider === "mock") return;
  if (cfg.provider === "openai" && !cfg.openai.apiKey) {
    throw new ProviderError("provider_not_configured", 500, "openai");
  }
  if (cfg.provider === "ollama" && (!cfg.ollama.baseUrl || !cfg.ollama.model)) {
    throw new ProviderError("provider_not_configured", 500, "ollama");
  }
}

export function destinationForLogs(cfg: AiRuntimeConfig): string {
  if (cfg.provider === "openai") return "https://api.openai.com";
  if (cfg.provider === "ollama") return cfg.ollama.baseUrl || "(OLLAMA_BASE_URL vacío)";
  return "mock";
}
