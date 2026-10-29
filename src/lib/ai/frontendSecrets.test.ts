import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("el frontend nunca recibe claves de proveedores", () => {
  it("no hay variables VITE_ de OpenAI, Ollama ni AI_PROVIDER", () => {
    const leaked = Object.keys(import.meta.env).filter((k) =>
      /^VITE_(OPENAI|OLLAMA|AI_PROVIDER|AI_TIMEOUT)/i.test(k)
    );
    expect(leaked).toEqual([]);
  });

  it("el cliente del asistente solo invoca la Edge Function", () => {
    const src = readFileSync(resolve(__dirname, "../../api/aiAssistantApi.ts"), "utf8");
    expect(src).toContain('functions.invoke("ai-assistant"');
    expect(src).not.toMatch(/OPENAI_API_KEY|OLLAMA_BASE_URL|sk-proj-/);
    expect(src).not.toMatch(/11434|\/api\/show|\/api\/chat/);
    expect(src).toMatch(/hostname !== "127\.0\.0\.1"/);
  });
});
