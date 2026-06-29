#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/uvicorn" ]; then
  echo "backend/.venv is missing. Run: python3 -m venv .venv && . .venv/bin/activate && pip install -e '.[dev]'" >&2
  exit 1
fi

exec .venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT"

