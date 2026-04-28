#!/usr/bin/env bash
set -euo pipefail

# Try a TCP probe at MONGO_URI's host:port before deciding how to bring Mongo up.
# Default: localhost:27017 (matches Backend/.env.example).
MONGO_HOST="${MONGO_HOST:-localhost}"
MONGO_PORT="${MONGO_PORT:-27017}"

mongo_reachable() {
  (echo > "/dev/tcp/${MONGO_HOST}/${MONGO_PORT}") >/dev/null 2>&1
}

if ! mongo_reachable; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "[dev] mongo not reachable — starting via docker compose…"
    docker compose up -d mongo
  else
    echo "[dev] mongo not reachable on ${MONGO_HOST}:${MONGO_PORT} and Docker is not available."
    echo "      Start a local mongo (brew services start mongodb-community)"
    echo "      or start Docker Desktop, then re-run ./dev.sh"
    exit 1
  fi
fi

echo "[dev] waiting for mongo to be ready on ${MONGO_HOST}:${MONGO_PORT}…"
for _ in $(seq 1 30); do
  if mongo_reachable; then
    echo "[dev] mongo ready"
    break
  fi
  sleep 1
done

if ! mongo_reachable; then
  echo "[dev] mongo did not become reachable in 30s — aborting"
  exit 1
fi

# Run backend + frontend concurrently with prefixed output
exec pnpm exec concurrently \
  --names "BE,FE" \
  --prefix "{name}" \
  --prefix-colors "cyan,magenta" \
  --kill-others-on-fail \
  "pnpm --dir Backend dev" \
  "pnpm --dir Frontend dev"
