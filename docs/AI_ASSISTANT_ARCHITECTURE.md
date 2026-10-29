# Asistente IA de Inorme — arquitectura

Fecha del análisis: 8 de octubre de 2026. Proyecto Supabase: `grasrjavkbeboynacvzp`.

## 1. Resumen

El asistente permite a usuarios autorizados del backoffice (`/admin/ai`) hacer preguntas sobre
facturación, gastos, proyectos y clientes y obtener análisis e informes basados en datos reales.

Principios:

- El modelo **nunca** ejecuta SQL. Solo puede invocar herramientas con implementación
  explícita, parámetros validados con Zod y consultas conocidas.
- El proveedor (OpenAI, Ollama/Qwen, mock) se elige con `AI_PROVIDER`. Ver `docs/AI_PROVIDER_ARCHITECTURE.md`.
- Las claves y URLs de modelos viven **solo** como secretos de Supabase. Nunca en `VITE_*`.
- Los permisos se deciden en la Edge Function a partir de la sesión Supabase y de la fila real de
  `backoffice_users`. Nada que envíe React se usa para autorizar.
- Al modelo se le envían agregados y listados acotados, no tablas completas.

## 2. Flujo

```
React (/admin/ai)
  → supabase.functions.invoke("ai-assistant", { conversationId?, message })   [JWT de sesión]
  → Edge Function ai-assistant
      1. CORS / método / tamaño del cuerpo
      2. auth.getUser() con el JWT → auth_user_id
      3. SELECT backoffice_users WHERE auth_user_id = … (role, active, enabled_modules, company_worker_id)
      4. canUseAssistant(principal)  → 403 si no procede
      5. Rate limit (ai_audit_logs, ventana 60 min) → 429
      6. Cargar / crear conversación (RLS con el cliente del usuario)
      7. Orquestador + AI Provider (OpenAI / Ollama / mock; máx. 6 iteraciones)
           - cada tool: checkAiPermission(principal, tool) → Zod → consulta → JSON acotado
      8. Persistir mensajes, auditar, devolver { reply, report?, toolsUsed, conversationId }
  → React renderiza markdown / informe
```

## 3. Modelo de datos real utilizado

Columnas verificadas contra el proyecto remoto (no contra las migraciones, que han derivado).

| Tabla | Columnas que usa el asistente |
|---|---|
| `backoffice_users` | `id, auth_user_id, role, active, enabled_modules, company_worker_id` |
| `billing_invoices` | `id, series_id, fiscal_year, invoice_number, status, payment_status, invoice_kind, issue_date, due_date, client_id, taxable_base_total, grand_total, collected_total` |
| `billing_series` | `id, code` |
| `clients` | `id, trade_name, company_name, client_kind, active, created_at` |
| `worker_expense_sheets` | `id, company_worker_id, status, period_start, period_end` |
| `worker_expense_sheet_lines` | `sheet_id, expense_date, amount_tickets, amount_taxis_parking, amount_kms_fuel, amount_toll, amount_per_diem, amount_hotel, amount_supplies, amount_other` |
| `company_workers` | `id, first_name, last_name` (solo para etiquetar agregados; nunca DNI, dirección, etc.) |
| `projects` | `id, project_code, title, client_id, final_client_id, start_date, end_date, responsible_company_worker_id, end_notice_at` |
| `project_members` | `project_id, company_worker_id, role` |

Hechos relevantes del esquema:

- `billing_invoices.status` ∈ DRAFT / ISSUED / PAID / CANCELLED; `payment_status` ∈ PENDING / PARTIAL / PAID.
  Las métricas de facturación cuentan solo `ISSUED` y `PAID` (los borradores se informan aparte).
- "Vencida" = `payment_status <> 'PAID'` y `due_date < hoy`. Si `due_date` es nulo no se considera vencida.
- Las facturas **no tienen `project_id`**: no existe facturación por proyecto en la base de datos.
  Las herramientas de proyectos lo indican explícitamente en lugar de inventarlo.
- `projects` no tiene columna de estado: el estado se deriva de `start_date` / `end_date`
  (activo, finalizado por fecha, futuro, sin fechas). No existe "atrasado" como dato; se informa
  "finaliza en ≤ 30 días" y "finalizado por fecha".
- Las categorías de gasto son las ocho columnas `amount_*` de `worker_expense_sheet_lines`.

## 4. Tablas nuevas (migración `20261008132339_ai_assistant.sql`)

> Estado: **aplicada en el proyecto remoto** (`grasrjavkbeboynacvzp`) el 2026-10-08 con la versión
> `20261008132339`, que coincide con el nombre del fichero local. Es idempotente, por lo que
> `supabase db push` desde CI no falla aunque se vuelva a ejecutar.

| Tabla | Propósito | RLS |
|---|---|---|
| `ai_conversations` | `id, user_id → backoffice_users, title, created_at, updated_at` | El usuario solo ve/crea/borra las suyas (`user_id = ai_current_backoffice_user_id()`). ADMIN no ve las de otros. |
| `ai_messages` | `id, conversation_id, role (user/assistant/tool), content, metadata jsonb, created_at` | SELECT/INSERT solo si la conversación es propia. Sin UPDATE/DELETE directo (borrado en cascada). |
| `ai_audit_logs` | `id, backoffice_user_id, conversation_id, action, tool_name, status, detail jsonb, duration_ms, created_at` | RLS activo **sin políticas** + `REVOKE` a `anon`/`authenticated`: solo `service_role` (la Edge Function) escribe y lee. |

Función auxiliar `ai_current_backoffice_user_id()` (SECURITY DEFINER, STABLE): devuelve el `id` de
`backoffice_users` activo del `auth.uid()` actual. Es independiente de `dms_current_backoffice_user_id`
para no acoplar módulos.

No se modifica ninguna tabla, política ni función existente.

## 5. Permisos

### 5.1 Quién puede abrir el asistente

- `ADMIN` activo: siempre.
- `WORKER` activo: si tiene en `enabled_modules` al menos uno de
  `FACTURACION`, `GASTOS`, `ADMIN_PROJECTS`, `ADMIN_CLIENTS`.
- Cualquier otro caso: 403 (`access_denied` en auditoría). El frontend oculta la entrada del menú
  con la misma regla (`canUseAiAssistant` en `src/lib/ai/aiAccess.ts`), pero la decisión real es
  la del servidor.

Decisión: no se añade un módulo nuevo `AI_ASSISTANT` porque exigiría modificar el CHECK
`backoffice_users_enabled_modules_valid` de una tabla existente. Si en el futuro se quiere un
interruptor explícito, basta con ampliar ese CHECK y la lista en `permissions.ts`.

### 5.2 Permisos por herramienta (`permissions.ts`, función `checkAiPermission`)

| Herramienta | Módulo requerido | Ámbito de datos |
|---|---|---|
| `get_billing_summary` | `FACTURACION` | Toda la facturación (igual que la pantalla `/admin/facturacion`) |
| `get_top_clients_by_billing` | `FACTURACION` | Toda |
| `get_pending_invoices` | `FACTURACION` | Toda |
| `get_invoice_list` | `FACTURACION` | Toda |
| `get_billing_comparison` | `FACTURACION` | Toda |
| `get_client_billing_comparison` | `FACTURACION` | Toda |
| `get_expenses_summary` | `GASTOS` | ADMIN: todos los trabajadores. WORKER: **solo su `company_worker_id`** |
| `get_top_expense_categories` | `GASTOS` | Igual que la anterior |
| `get_projects_summary` | `ADMIN_PROJECTS` | Todos los proyectos |
| `get_project_performance` | `ADMIN_PROJECTS` | Todos los proyectos |
| `get_clients_summary` | `ADMIN_CLIENTS` | Todos los clientes; los datos de facturación solo si además tiene `FACTURACION` |
| `get_data_catalog` | acceso al asistente | Catálogo de campos de negocio filtrado por módulos; sin SQL |
| `render_report` | acceso al asistente | — |
| `render_chart` | acceso al asistente | — |

Regla de módulos: la misma que el menú (`isWorkerModuleEnabled`): ADMIN tiene siempre
`FACTURACION`, `DMS` y los módulos de maestros; para el resto depende de su fila.
Excepción documentada: para el asistente, ADMIN también tiene `GASTOS`, porque ya ve y valida
todas las hojas de gastos en `/admin/gastos-trabajadores` (ruta protegida solo por rol). Por tanto
**ADMIN dispone de las herramientas de consulta**; no se amplía ningún acceso que no tuviera ya en la UI.

El modelo solo recibe en `tools` las herramientas que el usuario puede usar. Aun así, cada
ejecución vuelve a comprobar el permiso (defensa en profundidad).

## 6. Herramientas

Todas: parámetros validados con Zod (`npm:zod`), fechas ISO `YYYY-MM-DD`, `start_date <= end_date`,
rango máximo 731 días, `limit` acotado, resultados truncados. Devuelven JSON estructurado con
`period`, totales y filas; nunca credenciales, ni columnas personales (DNI, direcciones, IBAN, hashes).

- `get_billing_summary(start_date, end_date, compare_previous_period)`
  total facturado, base imponible, nº facturas (y rectificativas), pendientes/vencidas (nº e importe),
  cobrado, borradores; período anterior y variación.
- `get_top_clients_by_billing(start_date, end_date, limit≤25)`
- `get_pending_invoices(start_date?, end_date?, overdue_only, limit≤50)`
  referencia (serie/año/número), cliente, fechas, importe, cobrado, pendiente, días de retraso.
- `get_invoice_list(start_date, end_date, client_query?, min/max_amount?, min/max_quantity?, payment, order_by, order, limit≤100)`
  listado combinable: número, comentario, fecha, cliente, importe y cantidad (líneas BILLABLE). Solo emitidas/pagadas.
- `get_billing_comparison(period_a_start, period_a_end, period_b_start, period_b_end)`
- `get_client_billing_comparison(period_a…, period_b…, direction, limit≤25)`
- `get_expenses_summary(start_date, end_date, compare_previous_period, statuses?)`
  total, por categoría, por mes, por estado, nº hojas; ADMIN: top trabajadores.
- `get_top_expense_categories(start_date, end_date, limit≤8)`
- `get_projects_summary()`
- `get_project_performance(limit≤50, sort)` — solo métricas existentes: duración, días restantes,
  equipo, responsable, estado por fechas. Declara que no hay datos económicos por proyecto.
- `get_clients_summary()`
- `get_data_catalog(topic?)` — campos de negocio (factura, cliente, proyecto, gastos). Sin SQL.
- `render_report(report: AiReport)` — el modelo entrega el informe estructurado; la función lo
  valida y lo devuelve al frontend (`report`) junto con una versión markdown.

## 7. Integración con OpenAI

- API oficial Chat Completions (`https://api.openai.com/v1/chat/completions`) vía `fetch`,
  `tools` con `function calling`, `tool_choice: "auto"`.
- Modelo por defecto `gpt-4o-mini` (env `OPENAI_MODEL`), `temperature 0.2`, `max_tokens 1400`.
- Timeout 25 s por llamada (AbortController). Máximo 6 iteraciones de herramientas por petición.
- Historial: últimos 12 mensajes de la conversación leídos de la base de datos (no del cliente).
- Resultados de herramientas truncados a 8 000 caracteres antes de enviarse al modelo.
- El prompt de sistema incluye la fecha actual (Europe/Madrid), el rol y la lista de módulos
  disponibles para que el modelo sepa qué no puede consultar.

## 8. Rate limiting y coste

- Mensaje ≤ 2 000 caracteres; cuerpo ≤ 16 KB.
- 30 peticiones por usuario y hora (env `AI_RATE_LIMIT_PER_HOUR`), contadas en `ai_audit_logs`.
- Límite de iteraciones y de tokens; consultas con `limit` y rango de fechas acotado.
- Las agregaciones se hacen en la Edge Function sobre columnas mínimas; al modelo llega el resumen.

## 9. Manejo de errores

El frontend recibe siempre `{ error: { code, message } }` con mensajes genéricos en español
(`"No he podido consultar los datos de facturación. Inténtalo de nuevo."`). Los detalles técnicos
(errores PostgREST, respuestas de OpenAI) van solo a `console.error` de la función y, de forma
resumida y sin secretos, a `ai_audit_logs.detail`.

## 10. Seguridad y riesgos detectados en las políticas RLS actuales

Revisión de `pg_policies` en producción (8 oct 2026):

| Tabla | Política actual | Riesgo |
|---|---|---|
| `billing_invoices`, `billing_invoice_lines`, `billing_receipts`, `billing_issuers`, `billing_audit_logs` | `ALL` para `authenticated` si `is_backoffice_authenticated()` | Cualquier usuario de backoffice activo (también WORKER sin módulo `FACTURACION`) puede leer **y modificar** facturación vía PostgREST. El bloqueo por módulo solo existe en React. |
| `worker_expense_sheets`, `…_lines`, `…_attachments` | `ALL` para `authenticated`, `USING (true)` | Cualquier autenticado puede leer gastos de **otros** trabajadores. La restricción "solo los míos" es solo de frontend. |
| `company_workers`, `backoffice_users` | `ALL`, `USING (true)` | Cualquier autenticado puede leer DNI, direcciones, móviles y **cambiar `role`/`enabled_modules`/`active` de cualquier usuario**. |
| `clients`, `projects`, `project_members`, `entity_documents`, `worker_time_clock_events` | `ALL`, `USING (true)` | Lectura y escritura global para cualquier autenticado. |
| `dms_*` | Políticas finas con funciones `dms_can_*` | Correcto. |

Consecuencias para el asistente:

- El asistente **no amplía** ningún privilegio: consulta con el JWT del propio usuario (RLS igual
  que la app) y añade por encima la comprobación por módulo y el filtrado por `company_worker_id`
  en gastos. Es más restrictivo que PostgREST directo.
- Pero el asistente **no puede arreglar** el riesgo subyacente: un WORKER sin `FACTURACION` sigue
  pudiendo consultar `billing_invoices` con la anon key y su sesión fuera de la aplicación.
- Recomendación (fuera del alcance de esta tarea, requiere migraciones sobre tablas existentes):
  endurecer RLS con funciones `has_backoffice_module('FACTURACION')`, `is_backoffice_admin()` y
  políticas por fila para gastos (`company_worker_id = propio` o admin), y `UPDATE` de
  `backoffice_users` solo para ADMIN.

Otras decisiones de seguridad:

- `verify_jwt = true` en `config.toml` para `ai-assistant`.
- El cliente de datos en la función usa la **anon key + JWT del usuario**; el `service_role` se usa
  únicamente para `ai_audit_logs` (escritura/lectura de rate limit).
- `ai_audit_logs.detail` guarda parámetros validados y códigos de error, nunca mensajes de usuario
  completos ni resultados de herramientas.
- El usuario solo accede a sus conversaciones (RLS). No hay mezcla de contextos entre usuarios:
  cada petición reconstruye el historial desde su propia conversación.

## 11. Edge Function

`supabase/functions/ai-assistant/`

```
index.ts          entrada HTTP, auth, rate limit, bucle OpenAI, persistencia, auditoría
permissions.ts    AiPrincipal, canUseAssistant, checkAiPermission, TOOL_MODULES
dates.ts          validación de fechas y período anterior
openai.ts         cliente fetch con timeout y tipos
prompt.ts         prompt de sistema
report.ts         esquema Zod de AiReport, herramienta render_report, reportToMarkdown
tools/registry.ts lista de herramientas y despacho
tools/billing.ts  5 herramientas de facturación
tools/expenses.ts 2 herramientas de gastos
tools/projects.ts 2 herramientas de proyectos
tools/clients.ts  1 herramienta de clientes
```

Despliegue: `supabase functions deploy ai-assistant` (o la misma vía con la que se publicó
`reset-backoffice-password`). Secretos: `supabase secrets set OPENAI_API_KEY=sk-…`.
`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma.

## 12. Frontend

```
src/types/ai.ts                     AiReport, AiChatResponse, AiConversation, AiMessageModel
src/api/aiAssistantApi.ts           sendAiMessage (functions.invoke), conversaciones y mensajes
src/hooks/useAiAssistant.ts         React Query: conversaciones, mensajes, mutación de envío
src/lib/ai/aiAccess.ts              canUseAiAssistant (misma regla que el servidor)
src/lib/ai/format.ts                formatEuro, formatDateEs, formatPercent, reportToMarkdown
src/lib/ai/reportPdf.ts             exportación PDF con jsPDF (ya en el proyecto)
src/components/ai/AiAssistant.tsx   pantalla completa: conversaciones + chat
src/components/ai/AiChat.tsx        hilo, estado "Analizando…", composer, prompts sugeridos
src/components/ai/AiMessage.tsx     burbuja con markdown (react-markdown + remark-gfm)
src/components/ai/AiReportView.tsx  informe: KPIs, secciones, tablas, Exportar PDF
src/pages/admin/AdminAiAssistant.tsx página /admin/ai con comprobación de acceso
```

Ruta `/admin/ai` en `App.tsx` bajo `ProtectedRoute` + `PasswordChangeGate` + `RoleRoute`.
Entrada "✨ Asistente IA" en el menú lateral de ADMIN y de WORKER (si `canUseAiAssistant`).

Dependencias nuevas: `react-markdown`, `remark-gfm` (render de markdown y tablas GFM).

## 13. Informes y exportación

`AiReport = { title, period?, summary, kpis[], sections[], tables?[] }`. El modelo lo entrega vía
`render_report`; el frontend lo pinta con componentes shadcn y ofrece "Exportar PDF" (jsPDF, texto
plano estructurado). Excel/Word: el mismo objeto `AiReport` es la entrada; quedan como trabajo
futuro en `src/lib/ai/`.

`AiChart = { type: pie|column|bar|line, title, period?, unit, categories[], series[{ name, values }] }`.
El modelo llama a `render_chart` **después** de las tools de datos y copia cifras; el frontend lo
pinta con Recharts (quesito, columnas agrupadas, líneas). Máximo 3 gráficos por respuesta.
No se generan imágenes ni ASCII.

## 14. Variables de entorno

| Dónde | Variable | Uso |
|---|---|---|
| Frontend (Vercel / `.env`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Ya existentes. **Nunca** `VITE_OPENAI_*` ni `VITE_OLLAMA_*` |
| Supabase secrets | `AI_PROVIDER` | `openai` (defecto), `ollama` o `mock` |
| Supabase secrets | `OPENAI_API_KEY` | Obligatoria si `AI_PROVIDER=openai` |
| Supabase secrets (opcional) | `OPENAI_MODEL` (def. `gpt-4o-mini`) | Modelo OpenAI |
| Supabase secrets | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Obligatorias si `AI_PROVIDER=ollama` |
| Supabase secrets (opcional) | `OLLAMA_API_KEY` | Bearer hacia reverse proxy de Ollama |
| Supabase secrets (opcional) | `AI_TIMEOUT_MS` (def. código 25000; al cortar a Ollama partir de 60000), `AI_MAX_TOKENS` (1400), `AI_RATE_LIMIT_PER_HOUR` (30) | Límites. El timeout es por `chat()`, no por turno. Ver `docs/AI_OLLAMA_SETUP.md` §5. Producción sigue en OpenAI hasta un corte explícito. |

## 15. Decisiones técnicas

- Agregación en la Edge Function en lugar de RPC SQL: evita tocar el esquema y mantiene RLS del
  usuario; con el volumen actual (≈350 facturas, ≈150 líneas de gasto) es inmediato. Si crece,
  el siguiente paso natural es mover cada herramienta a una función SQL `SECURITY INVOKER`.
- Historial leído del servidor: el cliente solo envía `conversationId` y el texto nuevo.
- Respuesta no streaming: simplifica errores y auditoría; el frontend muestra estados rotativos
  ("Analizando los datos de Inorme…", "Consultando facturación…").
- Markdown con `react-markdown` + `remark-gfm` y estilos Tailwind propios (no se usa el plugin
  `typography`, que no está activado en `tailwind.config.ts`).
