# Arquitectura de proveedores de IA (Inorme)

La Edge Function `ai-assistant` ya no habla con un único vendor. El asistente, los permisos y
las herramientas de Inorme son independientes del modelo.

No se han modificado migraciones ni RLS para este cambio.

## 1. Capas

```
React (/admin/ai)          ← nunca ve claves ni URLs de modelos
        │  JWT de sesión
        ▼
Supabase Edge Function     ← auth, backoffice_users, rate limit, persistencia
        │
        ▼
AI Orchestrator            ← bucle mensajes ↔ herramientas
        │
        ▼
AI Provider                ← un solo adapter por petición
   ┌────┼────┐
 Mock  Ollama  OpenAI      ← (Anthropic / Gemini: nuevo archivo, mismo contrato)
        │
        ▼
Inorme Tools               ← SQL conocido + Zod + checkAiPermission
        │
        ▼
PostgreSQL (RLS del usuario)
```

El orquestador **no** está acoplado al chatbot: el futuro *Dashboard Builder* debe llamar a
`runAiTurn()` (o un `runAiTurn` con `structured`) con las mismas herramientas.

## 2. Contrato del provider

```typescript
interface AIProvider {
  readonly name: "openai" | "ollama" | "mock";
  readonly model: string;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  supportsToolCalling(): boolean | Promise<boolean>;
  supportsStructuredOutput(): boolean | Promise<boolean>;
}
```

Tipos internos (`AIMessage`, `AIToolSpec`, `AIToolCall`, `AIStructuredOutputSpec`) no son los de
OpenAI. Cada adapter convierte:

| Interno | OpenAI | Ollama |
|---|---|---|
| `AIToolSpec` | `tools[].function` | `tools[].function` (mismo JSON) |
| `tool_calls[].arguments` objeto | string JSON | objeto JSON |
| mensaje `role: tool` | `tool_call_id` | `tool_name` |
| `AIStructuredOutputSpec` | `response_format.json_schema` | `format: <schema>` |

## 3. Cómo cambiar de proveedor

Secretos de **Supabase** (Edge Functions → Secrets), nunca `VITE_*`:

```text
AI_PROVIDER=openai
```

```text
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://mi-servidor-ai.example.com
OLLAMA_MODEL=qwen3:8b
```

El corte a Ollama en producción **no está hecho**. Checklist, red, timeout y health:
`docs/AI_OLLAMA_SETUP.md`.

```text
AI_PROVIDER=mock
```

Reinicia / redespliega la función para que coja los secretos. No hace falta cambiar React.

## 4. Cómo añadir un proveedor

1. Implementar `AIProvider` en `supabase/functions/ai-assistant/provider/<nombre>Provider.ts`.
2. Añadir el nombre a `AIProviderName` y al `createProvider()`.
3. Documentar variables. **No** añadir fallback hacia OpenAI.

## 5. Herramientas

Siguen siendo las mismas (`get_billing_summary`, …). El modelo **nunca** ejecuta SQL. Si un
modelo no admite tool calling, el provider lanza `provider_tools_unsupported` (mensaje claro;
no se degrada a SQL libre).

Los permisos (`checkAiPermission`) se aplican igual con OpenAI, Ollama o mock. Se leen de
`backoffice_users` en el servidor.

## 6. Privacidad

| `AI_PROVIDER` | Destino de los datos de negocio enviados al modelo |
|---|---|
| `openai` | `https://api.openai.com` |
| `ollama` | solo `OLLAMA_BASE_URL` (no se llama a OpenAI) |
| `mock` | ningún servicio externo |

No hay fallback automático Ollama → OpenAI (evitaría un coste no autorizado).

Al modelo solo llegan agregados de las herramientas (límites de filas, sin secretos, sin tablas
completas).

## 7. Structured output

`AIStructuredOutputSpec` está listo para informes, widgets y dashboards. Hoy el chat usa
`render_report` (herramienta). El dashboard futuro no debe añadir un segundo cliente HTTP.

## 8. Observabilidad

`ai_audit_logs.detail` incluye `provider`, `model`, `tools`, `total_tokens` (si el vendor lo da),
errores. No se registran API keys ni el cuerpo de OpenAI/Ollama.

`OllamaProvider.healthCheck()` distingue unreachable / model_missing / tools_unsupported /
timeout / http_error / ready. No está expuesto por HTTP ni al frontend (la URL de Ollama no
viaja en el resultado). Ver `docs/AI_OLLAMA_SETUP.md` §3.

## 9. Variables

Ver tabla en `docs/AI_ASSISTANT_ARCHITECTURE.md` §14 y `docs/AI_OLLAMA_SETUP.md`.

## 10. Qwen

No hay una versión de Qwen fijada en código. Se elige con `OLLAMA_MODEL`.
El tag validado en local con tool calling estructurado es `qwen3:8b`.
El modelo debe declarar *tools* en Ollama; si no, error explícito.
