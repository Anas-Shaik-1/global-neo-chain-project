#!/usr/bin/env bash
set -euo pipefail

# Bring up Mongo if not already running
if ! docker compose ps --status running --services | grep -q '^mongo$'; then
  echo "[dev] starting mongo via docker compose…"
  docker compose up -d mongo
fi

# Wait for Mongo to accept connections
echo "[dev] waiting for mongo to be ready…"
for _ in $(seq 1 30); do
  if docker compose exec -T mongo mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
    echo "[dev] mongo ready"
    break
  fi
  sleep 1
done

# Run backend + frontend concurrently with prefixed output
exec pnpm exec concurrently \
  --names "BE,FE" \
  --prefix "{name}" \
  --prefix-colors "cyan,magenta" \
  --kill-others-on-fail \
  "pnpm --dir Backend dev" \
  "pnpm --dir Frontend dev"
