# Ollama para Inorme

Objetivo: que la Edge Function `ai-assistant` hable con **tu** instancia Ollama (Qwen u otro
modelo open-weight) sin exponer el modelo al navegador.

**Estado actual de producción:** `AI_PROVIDER=openai`. Este documento prepara el corte a Ollama.
**No** cambia secretos remotos ni despliega esa configuración.

Única comunicación permitida:

```
frontend → ai-assistant → Ollama
```

El frontend **nunca** llama a Ollama. No existen `VITE_OLLAMA_*`.

## 1. Host: Mac fuera, Cloud primero (uso mínimo)

**No** uses el Mac de desarrollo como servidor de Ollama para Inorme. `127.0.0.1:11434`
no es alcanzable desde la Edge Function de Supabase Cloud.

Con uso bajo, la opción preferida es **Ollama Cloud** (`https://ollama.com`):

- Misma API que el adapter (`/api/chat`, `/api/show`, Bearer).
- HTTPS y autenticación de fábrica. No hay que abrir el puerto 11434.
- No hay que instalar GPU ni mantener un VPS.

El Mac solo sirve para desarrollo local opcional. Un VPS propio queda para más adelante
si el volumen o la residencia de datos lo exigen.

`qwen3:8b` (validado en local) **no** está en el catálogo cloud (404). Hay que elegir un
modelo cloud con `capabilities` que incluya `tools`. Comprobado en `https://ollama.com/api/show`:

| Modelo cloud | `tools` |
|---|---|
| `gpt-oss:20b` | sí (candidato inicial, más ligero de los listados) |
| `gpt-oss:120b` | sí |
| `gemma4:31b` | sí |
| `glm-5.3-flash` | sí |

Candidato inicial: `gpt-oss:20b`. No se cambia el tag hasta pasar health + una prueba de
tool calling real. Crear la API key en [ollama.com](https://ollama.com) / cuenta → API keys.
Nunca en `VITE_*` ni en el frontend.

## 2. Arquitectura (Cloud, aún no cortada en producción)

```
Usuarios Inorme
    │  JWT de sesión
    ▼
React (Vercel)                 ← sin URL de Ollama, sin API keys
    │  supabase.functions.invoke("ai-assistant")
    ▼
Edge Function ai-assistant     ← región del proyecto Supabase
    │  HTTPS + Authorization: Bearer OLLAMA_API_KEY
    ▼
https://ollama.com/api/chat    ← Ollama Cloud
    │
    ▼
modelo cloud con tools (p. ej. gpt-oss:20b)
```

Si más adelante se self-hostea: reverse proxy con TLS + auth, nunca `0.0.0.0:11434` público,
nunca `127.0.0.1` como `OLLAMA_BASE_URL` de producción.

Hasta un corte **explícito**, producción sigue en OpenAI.

## 3. Health check (diseñado, no desplegado)

`OllamaProvider.healthCheck()` usa el **mismo** cliente (`/api/show`, mismos headers). No hay un
segundo cliente HTTP. **No** forma parte del contrato `AIProvider`. **No** hay ruta HTTP nueva
en `ai-assistant` y **no** se llama desde React.

El resultado **nunca** incluye la URL de Ollama. Estados:

| `status` | Significado |
|---|---|
| `ready` | Modelo accesible; `capabilities` incluye `tools` (o Ollama antiguo sin campo) |
| `unreachable` | Red / DNS / conexión rechazada |
| `model_missing` | HTTP 404 o «model not found» |
| `tools_unsupported` | Modelo existe pero `capabilities` no incluye `tools` |
| `timeout` | Abort por `AI_TIMEOUT_MS` |
| `http_error` | Otro status HTTP (502, 401, …) |

Cuando se abra el health al operador, el canal debe ser `frontend → ai-assistant → Ollama`
(p. ej. un ADMIN autenticado). Nunca un `fetch` del navegador a `OLLAMA_BASE_URL`.

## 4. Secretos (checklist, no aplicar ahora)

Producción **sigue** con `AI_PROVIDER=openai`. Cuando se decida el host, estos secretos de
Supabase (Edge Functions → Secrets), con valores reales que **no** van en el repo:

```text
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_API_KEY=          # API key de ollama.com (obligatoria en Cloud)
AI_TIMEOUT_MS=60000
AI_MAX_TOKENS=1400
```

`OLLAMA_BASE_URL` es el origen (`https://ollama.com`); el adapter añade `/api/chat` y `/api/show`.
No uses `https://ollama.com/api` como base (duplicaría `/api/api/chat`).

El adapter envía `think: false` en `/api/chat`. En `gpt-oss` el razonamiento interno
consume `AI_MAX_TOKENS` y a veces deja `content` vacío (el usuario ve
«No he obtenido una respuesta»). Las tools de Inorme ya hacen el análisis.

`qwen3:8b` queda como referencia **local**. En Cloud el tag se elige de `/api/tags` y debe
tener `tools`.

No hace falta borrar `OPENAI_API_KEY`; con `AI_PROVIDER=ollama` no se usa.

Comandos (solo cuando se autorice el corte; **no ejecutar ahora**):

```bash
# NO ejecutar todavía
npx supabase secrets set AI_PROVIDER=ollama --project-ref grasrjavkbeboynacvzp
npx supabase functions deploy ai-assistant --project-ref grasrjavkbeboynacvzp
```

Volver a OpenAI: `AI_PROVIDER=openai`. Los `OLLAMA_*` se ignoran.

## 5. Timeout

Medidas locales (Qwen 3 8B, Mac, `stream: false`):

| Escenario | Tiempo |
|---|---|
| Chat básico Inorme | ~9 s |
| Ciclo tool (`get_billing_summary` + respuesta) | ~24 s |
| Dashboard (varias tools) | 20–75 s |

`AI_TIMEOUT_MS` aplica a **cada** `chat()` del adapter, no al turno entero. El orquestador puede
hacer hasta 6 iteraciones: el tiempo de pared del turno es la suma. No hay timeout de conexión
separado: un único `AbortController` cubre DNS + TLS + cuerpo.

| Ámbito | Qué corta | Recomendación inicial de producción |
|---|---|---|
| Conexión vs total | No están separados hoy | Un valor de turno-redondo por llamada `/api/chat` |
| Valor por defecto del código | 25000 ms | Corto para un ciclo con tool (~24 s) |
| Prueba local | 90000 ms | Holgado para dashboard; no usarlo a ciegas en prod |
| **Inicial al cortar a Ollama** | — | **60000 ms** por `chat()`, no 90 s |

60 s cubre el ciclo con tool (~24 s) y deja margen, sin igualar el peor dashboard de 6
reintentos inválidos. Si el host de producción es más lento, se sube con evidencia.

Si Ollama está saturado: la petición espera en cola del servidor; si supera `AI_TIMEOUT_MS`
el adapter lanza `provider_timeout` (HTTP 504). El usuario ve: *«El análisis ha tardado
demasiado. Inténtalo de nuevo con una pregunta más concreta.»* Se audita `provider_error` /
`provider_timeout`. **No hay reintentos automáticos** (evitarían duplicar tool calls).

## 6. Concurrencia

Cada petición HTTP de `ai-assistant` es independiente (sin mutex). El límite de Inorme es
`AI_RATE_LIMIT_PER_HOUR` (def. 30) por usuario. Ollama, en un solo GPU/host, **serializa o
solapa poco** las inferencias.

Medida local (mismo Mac, `qwen3:8b`, prompt corto de confirmación, modelo ya caliente):

| Peticiones simultáneas | Todas OK | Tiempo de pared | Max por petición |
|---|---|---|---|
| 1 | sí | ~5 s | ~5 s |
| 2 | sí | ~10 s | ~10 s |
| 5 | sí | ~19 s | ~19 s |

Con 2 y 5 el tiempo de pared crece casi en proporción: hay poca paralelización real.
Un ciclo Inorme con tools (~24 s) en 5 usuarios a la vez puede acercarse al timeout de 60 s
en las peticiones que van detrás en la cola. No se ha saturado hasta el error en estas
pruebas; el riesgo es **latencia / timeout**, no corrupción de tools.

En producción hay que repetir 1 / 2 / 5 (y más adelante 10) **en el host definitivo**, con
el mismo `qwen3:8b` y un turno `intent: chat` real, antes de abrir el asistente a todos.

## 7. Comprobar el modelo cloud (antes de cortar)

```bash
curl -s https://ollama.com/api/show -d '{"model":"gpt-oss:20b"}'
# `capabilities` debe incluir "tools".
```

Con API key, prueba de chat (no pongas la key en el repo):

```bash
curl https://ollama.com/api/chat \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","stream":false,"messages":[{"role":"user","content":"Di solo OK."}]}'
```

Si el modelo no declara `tools`, Inorme responde `provider_tools_unsupported` y **no** degrada
a SQL libre.

Self-host (más adelante, no el Mac de desarrollo): `ollama pull` de un tag con tools + proxy HTTPS.

## 8. Desarrollo local (Ollama Cloud, no el Mac)

1. `supabase/.env.ai-local` (gitignored): `AI_PROVIDER=ollama`,
   `OLLAMA_BASE_URL=https://ollama.com`, `OLLAMA_MODEL=gpt-oss:20b`, `OLLAMA_API_KEY=…`,
   `AI_TIMEOUT_MS=60000`. Nunca `VITE_*`.
2. Arranca la función: `sh scripts/ai-assistant-local.sh` → `http://127.0.0.1:8790`.
3. `.env.local` (gitignored): `VITE_AI_ASSISTANT_FUNCTION_URL=http://127.0.0.1:8790`
   para que `npm run dev` llame a esa función. El cliente **rechaza** cualquier host que no
   sea loopback. Reinicia Vite tras crear el archivo.
4. Entra en `/admin/ai` con tu usuario. El navegador no habla con ollama.com.

Desarrollo sin modelo: `AI_PROVIDER=mock`.

## 9. Corte a producción (no ejecutar ahora)

1. API key de Ollama Cloud (no el Mac).
2. Health check `ready` + `tools=yes` para el tag elegido (`gpt-oss:20b` u otro del catálogo).
3. Prueba de tool calling estructurado (no vale el texto «voy a usar la tool»).
4. Smoke local de `ai-assistant` contra `https://ollama.com` (sigue sin cambiar prod).
5. Autorizar explícitamente `secrets set` + deploy.
6. Smoke en producción: chat básico, tool de facturación, un widget de dashboard.
7. Plan de vuelta: `AI_PROVIDER=openai`.
