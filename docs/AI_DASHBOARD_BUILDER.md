# AI Dashboard Builder

Panel personal por usuario (`/admin/dashboard`, «Mi panel»). El asistente operativo de `/admin` no se sustituye.

La IA **no** genera HTML, JSX, React ni SQL. Traduce lenguaje natural a herramientas estructuradas. Los datos de cada widget se cargan después con TanStack Query → capa de datos → Supabase (JWT + RLS), **sin volver a llamar al modelo**.

## Arquitectura

```
Usuario (chat «Personalizar con IA»)
    → Edge Function `ai-assistant` (intent: dashboard)
    → runAiTurn() + AIProvider (OpenAI | Ollama | Mock)
    → herramientas del Dashboard Builder
    → dashboard_widgets (RLS)
    → React Query invalida
    → Dashboard Engine
    → dashboardDataService (loadWidgetData)
    → tablas reales (billing_invoices, gastos, projects, clients)
    → KPI / recharts / tabla
```

Reutiliza el orquestador existente. No hay un segundo cliente de IA.

- **intent `chat`**: herramientas de consulta (`get_billing_summary`, …) + `render_report`.
- **intent `dashboard`**: solo herramientas de widgets. El modelo no consulta facturación para pintar un gráfico.

## Tablas

Migraciones locales (no aplicadas automáticamente):

- `supabase/migrations/20261009120000_dashboard_builder.sql` — tablas y RLS inicial.
- `supabase/migrations/20261009154500_dashboard_builder_security.sql` — dueño del schedule, catálogo/módulos en trigger, caché `AI_REPORT`, RPC transaccional de apply/undo.

| Tabla | Uso |
| --- | --- |
| `dashboard_widgets` | Configuración de cada widget (tipo, título, `config` jsonb, `position` jsonb, width 1–12, height 1–8). |
| `dashboard_preferences` | `undo_snapshot` (deshacer) y `pending_layout` (previsualización). |
| `dashboard_schedules` | Infraestructura (`daily` / `weekly` / `monthly`, hora, weekday 1–7). Sin ejecutor/cron todavía. |

No se modifican tablas de negocio.

## RLS

Helper: `public.ai_current_backoffice_user_id()`.

Cada fila lleva `user_id` del `backoffice_users` autenticado. Políticas `*_own` en SELECT/INSERT/UPDATE/DELETE. `anon` sin grants. Un usuario no puede leer ni mutar widgets de otro.

La validación de módulos (FACTURACION, GASTOS, …) está en API, tools **y** trigger `dashboard_widget_guard` / `dashboard_user_has_source`. Un schedule no puede apuntar al widget de otro usuario (RLS + trigger `dashboard_schedule_widget_owned`).

## Widgets

Tipos: `KPI`, `KPI_VARIATION`, `LINE_CHART`, `BAR_CHART`, `PIE_CHART`, `TABLE`, `RANKING`, `ALERT`, `AI_REPORT`.

`config` guarda **configuración**, no datos masivos. Catálogo cerrado:

| Fuente | Módulo | Métricas | Datasets |
| --- | --- | --- | --- |
| `billing` | FACTURACION | total, invoice_count, pending_amount, overdue_count, collected_total | pending_invoices, top_clients |
| `expenses` | GASTOS | total, sheet_count | top_categories |
| `projects` | ADMIN_PROJECTS | active_count, ending_soon_count, without_team_count | ending_soon, attention |
| `clients` | ADMIN_CLIENTS | active_count, total_count | active_without_projects |

Facturación: solo ISSUED/PAID; pendiente = grand_total − collected_total si no PAID; vencida = no PAID y due_date < hoy.

## Herramientas

`list_dashboard_widgets`, `create_dashboard_widget`, `update_dashboard_widget`, `delete_dashboard_widget`, `move_dashboard_widget`, `resize_dashboard_widget`, `clear_dashboard`, `duplicate_dashboard_widget`, `propose_dashboard_layout`, `apply_dashboard_layout`, `schedule_dashboard_widget`.

Localización por `widget_id` o `title_query`. Si hay ambigüedad al borrar, la tool no elimina.

No existen `execute_sql` ni consultas arbitrarias.

## Flujo IA

1. El usuario pulsa «✨ Personalizar con IA».
2. El cliente envía `{ message, intent: "dashboard" }` a `ai-assistant`.
3. El servidor inyecta widgets actuales y fuentes permitidas en el system prompt.
4. `runAiTurn()` ejecuta tools con el JWT del usuario (RLS).
5. El front invalida `queryKeys.dashboardWidgets` y el grid se actualiza.

Cambios grandes: `propose_dashboard_layout` + botones Aplicar / Cancelar. Cambios pequeños: se aplican al momento. Antes de mutar se guarda `undo_snapshot`.

## Flujo de datos

Cada widget tiene su query (`staleTime` 5 min). **`AI_REPORT` no llama a la IA al abrir el panel**: muestra `report_content` cacheado. Solo se llama al modelo al pulsar «Actualizar informe» o cuando un scheduler futuro lo pida.

### Deuda previa (gastos)

`worker_expense_sheets` sigue con RLS `FOR ALL TO authenticated USING (true)`. Eso **no** lo introduce el Dashboard Builder. El builder recorta siempre por `company_worker_id` del perfil de sesión (un WORKER no puede fingir `role: ADMIN` en React para ver gastos ajenos **en el widget**). Un cliente que hable con PostgREST directo contra esa tabla sigue pudiendo listar hojas ajenas: deuda técnica **prioritaria**, fuera de esta fase.

## Layout

Grid CSS 12 columnas en desktop, 1 en móvil. Arrastre HTML5 para intercambiar posición; menú para subir, ensanchar, refrescar y eliminar. Librería de gráficos: **recharts** (ya usada en Inorme).

## Programaciones

`dashboard_schedules` admite «cada lunes» (`weekly`, weekday=1). No hay worker que ejecute informes todavía. Un schedule no puede apuntar al widget de otro usuario (RLS + trigger).

## Apply / undo

`apply_own_dashboard_layout` y `restore_own_dashboard_undo` son RPC `SECURITY INVOKER` (una transacción). Si la RPC aún no existe en el entorno, el cliente/Edge tiene un fallback; el de `replace` borra lo insertado a medias, pero **no** restaura widgets previos — por eso hay que aplicar la migración de seguridad.

## Variables de entorno

Ninguna nueva en el frontend. Las mismas de la arquitectura de proveedores:

- `AI_PROVIDER=mock|openai|ollama`
- `OPENAI_*`, `OLLAMA_*` (solo Edge Function / secretos de Supabase, nunca `VITE_*`)

## Cómo probar

1. Aplicar la migración en el entorno deseado (`npx supabase db push` o SQL Editor). **No se ha hecho push a producción desde este cambio.**
2. Redeploy de `ai-assistant` para las tools nuevas.
3. Entrar en `/admin/dashboard`.

**Mock:** `AI_PROVIDER=mock` en la Edge Function. El chat del panel dispara `propose_dashboard_layout` / `create` / `delete` / `move` / `resize` / `schedule` sin OpenAI.

**Ollama:** `AI_PROVIDER=ollama` y un modelo con tool calling (p. ej. Qwen). Misma Edge Function, mismas tools.

**OpenAI:** requiere saldo; no hace falta para desarrollar el builder.
