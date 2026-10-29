#!/bin/sh
# Arranca ai-assistant en 127.0.0.1:8790 con supabase/.env.ai-local (Ollama Cloud).
# No cambia producción. Requiere Deno en ~/.local/deno o en PATH.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/supabase/.env.ai-local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE (gitignored). Cópialo desde la plantilla de docs/AI_OLLAMA_SETUP.md" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
export PORT="${PORT:-8790}"
export AI_LISTEN_HOST="${AI_LISTEN_HOST:-127.0.0.1}"
export DENO_NO_PACKAGE_JSON=1
export PATH="${HOME}/.local/deno/bin:${PATH}"
cd "$ROOT/supabase/functions/ai-assistant"
exec deno run --node-modules-dir=auto --allow-net --allow-env --allow-sys ./serve-local.ts
