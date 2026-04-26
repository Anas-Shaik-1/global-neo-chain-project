# Foundation Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Foundation by tying Backend + Frontend together with: a Docker Compose for MongoDB, a `dev.sh` that runs both apps concurrently, a top-level README, and a final end-to-end smoke run that verifies every Definition-of-Done item from the spec.

**Architecture:** Root-level orchestration only — no new application code. The backend and frontend remain independent Node roots; root scripts just start the right things in the right order.

**Tech Stack:** Docker, Docker Compose, bash, `concurrently` (dev only), Node 20.

**Reference spec:** `docs/superpowers/specs/2026-04-25-foundation-design.md`.
**Predecessor plans:** `2026-04-25-foundation-backend.md` and `2026-04-25-foundation-frontend.md` — both must be complete (tags `foundation-backend-done` and `foundation-frontend-done` exist) before starting this plan.

---

## Task 1: Docker Compose for MongoDB

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml` at repo root**

```yaml
services:
  mongo:
    image: mongo:7
    container_name: ems-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - ems-mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.runCommand({ ping: 1 }).ok"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  ems-mongo-data:
```

- [ ] **Step 2: Smoke test**

```bash
docker compose up -d
docker compose ps
docker compose exec mongo mongosh --quiet --eval 'db.runCommand({ping: 1}).ok'
```

Expected:
- `docker compose ps` shows `ems-mongo` healthy.
- The `mongosh` ping returns `1`.

- [ ] **Step 3: Stop and remove volume so subsequent tasks start clean (optional)**

```bash
docker compose down -v
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: docker-compose for MongoDB 7"
```

---

## Task 2: Root `package.json` + `dev.sh`

**Files:**
- Create: `package.json` (root)
- Create: `dev.sh`

The root `package.json` exists only to host `concurrently` and the `dev`/`seed` scripts. It does **not** introduce a workspace.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "global-neo-chain-project",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "./dev.sh",
    "dev:backend": "pnpm --dir Backend dev",
    "dev:frontend": "pnpm --dir Frontend dev",
    "seed": "pnpm --dir Backend seed",
    "gen:api": "pnpm --dir Frontend gen:api",
    "test": "pnpm --dir Backend test && pnpm --dir Frontend test",
    "compose:up": "docker compose up -d",
    "compose:down": "docker compose down",
    "compose:logs": "docker compose logs -f"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

- [ ] **Step 2: Install root dev deps**

```bash
pnpm install
```

- [ ] **Step 3: Create `dev.sh`**

```bash
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
```

- [ ] **Step 4: Make it executable**

```bash
chmod +x dev.sh
```

- [ ] **Step 5: Smoke test (manual)**

```bash
./dev.sh
```

Expected:
- Mongo starts (or is already running).
- Backend logs `EMS backend listening` on `:3000`.
- Frontend logs Vite ready on `:5173`.
- Visiting `http://localhost:5173` redirects to `/login`.

Ctrl-C — both processes terminate.

- [ ] **Step 6: Commit**

```bash
git add package.json dev.sh pnpm-lock.yaml
git commit -m "chore: root scripts + dev.sh for concurrent BE+FE + mongo wait"
```

---

## Task 3: Top-level README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Global NeoChain — SMS-IP Employee Management System

Production-grade Employee Management System (EMS) for SMS-IP (Sehat - Meyer - Sejahtera Indonesian Professionals).

## Stack

- **Backend:** Node 20 + TypeScript (ESM), Express 5, MongoDB + Mongoose, Zod, JWT (access + refresh rotation), Socket.io, pino, swagger-ui-express, OpenAPI (via `@asteasolutions/zod-to-openapi`).
- **Frontend:** Vite + React 19 + TypeScript, Tailwind, shadcn/ui (`new-york`), Redux Toolkit (auth + UI state), TanStack Query (server data), axios with refresh-on-401, orval-generated TanStack hooks, react-router 7.
- **Infra (dev):** Docker Compose (MongoDB), `dev.sh` to run BE + FE concurrently.

## Layout

```
.
├── Backend/                # Node + Express + Mongo
├── Frontend/               # Vite + React
├── docs/superpowers/       # Specs and plans
├── docker-compose.yml      # Mongo
├── dev.sh                  # Concurrent dev runner
└── package.json            # Root scripts only
```

## Prerequisites

- Node 20 LTS (or newer)
- pnpm 9+
- Docker Desktop (for Mongo via compose)

## First-time setup

```bash
# 1. Install dependencies for all projects
pnpm install
pnpm --dir Backend install
pnpm --dir Frontend install

# 2. Provision env files
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env

# 3. Start Mongo
docker compose up -d

# 4. Seed an admin user (reads SEED_ADMIN_* from Backend/.env)
pnpm seed

# 5. Generate the typed API client (one-time; backend must be reachable)
pnpm --dir Backend dev &     # leave backend running in another terminal
pnpm gen:api                 # writes Frontend/src/api/generated
```

## Daily development

```bash
./dev.sh
```

Brings up Mongo (if needed), then runs Backend on `:3000` and Frontend on `:5173` concurrently with prefixed output.

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/openapi.json

## Tests

```bash
pnpm test
# or per project:
pnpm --dir Backend test
pnpm --dir Frontend test
```

## Auth

- Default seeded admin: `admin@sms-ip.local` / value of `SEED_ADMIN_PASSWORD`.
- Access token (15 min) returned in JSON; refresh token (7 days) in `HttpOnly Secure SameSite=Strict` cookie at `Path=/auth`.
- Refresh rotates on every `/auth/refresh`; re-using a stale refresh revokes the entire family.
- Roles: `ADMIN`, `HR`, `EMPLOYEE`, `PM`.

## Adding a new feature module (Backend)

1. Create `Backend/src/modules/<name>/`.
2. Add Mongoose model under `Backend/src/models/`.
3. Define Zod schemas in `<name>.schema.ts` and register paths via `registry.registerPath(...)`.
4. Implement service + controller + router.
5. Mount router in `Backend/src/app.ts`.
6. Run `pnpm gen:api` from Frontend to refresh the typed client.

## Documentation

- Spec: `docs/superpowers/specs/2026-04-25-foundation-design.md`
- Plans (in order):
  - `docs/superpowers/plans/2026-04-25-foundation-backend.md`
  - `docs/superpowers/plans/2026-04-25-foundation-frontend.md`
  - `docs/superpowers/plans/2026-04-25-foundation-orchestration.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: top-level README covering setup, dev, tests, auth"
```

---

## Task 4: End-to-end smoke verification

**Goal:** Walk every Definition-of-Done bullet from the spec (`§11`) and confirm it.

- [ ] **Step 1: Clean slate**

```bash
docker compose down -v 2>/dev/null || true
docker compose up -d
```

Wait for compose to report `ems-mongo` healthy:

```bash
docker compose ps
# STATUS should be "Up (healthy)"
```

- [ ] **Step 2: Backend boot + curl checks**

```bash
cd Backend
pnpm seed
pnpm dev &
BACKEND_PID=$!
sleep 4
curl -s http://localhost:3000/health
# Expected: {"status":"ok"}
curl -s -i -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@sms-ip.local","password":"ChangeMe-Admin-1!"}'
# Expected: HTTP/1.1 200 OK + Set-Cookie: refresh=...; Path=/auth; HttpOnly
curl -s http://localhost:3000/openapi.json | head -c 80
# Expected: {"openapi":"3.1.0","info":{...
kill $BACKEND_PID
cd ..
```

If any of those fail, stop and fix in the relevant Backend task before continuing.

- [ ] **Step 3: Regenerate API client**

```bash
cd Backend && pnpm dev &
BACKEND_PID=$!
sleep 4
cd Frontend && pnpm gen:api
ls src/api/generated
cd ..
kill $BACKEND_PID
```

Expected: at least `src/api/generated/auth/auth.ts` produced.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: every Backend + Frontend test passes (~55+ total).

- [ ] **Step 5: Type-check + builds**

```bash
pnpm --dir Backend exec tsc -p tsconfig.json --noEmit
pnpm --dir Frontend exec tsc -b
pnpm --dir Backend build
pnpm --dir Frontend build
```

Expected: zero TS errors on either side; both `dist/` directories produced.

- [ ] **Step 6: Full dev stack smoke**

```bash
./dev.sh
```

In a browser:

1. **Open `http://localhost:5173`.** Expect immediate redirect to `/login`.
2. **Submit form** with `admin@sms-ip.local` / `ChangeMe-Admin-1!`. Expect redirect to `/dashboard` showing the AppLayout shell.
3. **Confirm Sidebar** at `lg+` width has links: Dashboard, Tasks, Messages, Attendance, Expenses, Payroll. Each renders an `EmptyState` placeholder when clicked.
4. **Confirm Topbar** shows: "Welcome, Admin", a theme-toggle (sun/moon icon), and an avatar dropdown with role label, Profile (disabled), Log out.
5. **Toggle theme.** `<html>` gains/loses the `dark` class. `localStorage.getItem("ems.theme")` reflects the new value (DevTools).
6. **Hard refresh (Cmd-Shift-R) at `/dashboard`.** Expect a brief spinner then the same dashboard — silent refresh worked.
7. **Open DevTools → Network → `/auth/refresh`.** Confirm the request is sent with `Cookie: refresh=...` and the response has `Set-Cookie: refresh=...; Path=/auth` (rotated).
8. **Click avatar → Log out.** Expect redirect to `/login`. Try going back to `/dashboard` — expect redirect to `/login` again.
9. **Open `http://localhost:3000/docs`.** Swagger UI lists the `auth` and `health` tags.
10. **Open `http://localhost:3000/openapi.json`.** Returns the spec JSON.

Stop with Ctrl-C.

- [ ] **Step 7: Refresh-reuse manual check**

```bash
./dev.sh &
DEV_PID=$!
sleep 6

# Login and capture cookie
RESP=$(curl -s -i -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@sms-ip.local","password":"ChangeMe-Admin-1!"}')
COOKIE=$(echo "$RESP" | awk '/Set-Cookie: refresh=/ {print $2}' | head -1 | sed 's/;.*//')

# First refresh — should succeed and rotate
curl -s -i -X POST http://localhost:3000/auth/refresh \
  -H "Cookie: $COOKIE" | head -1
# Expected: HTTP/1.1 200 OK

# Reuse the original (now stale) cookie — should 401
curl -s -i -X POST http://localhost:3000/auth/refresh \
  -H "Cookie: $COOKIE" | head -1
# Expected: HTTP/1.1 401 Unauthorized

kill $DEV_PID
```

If both lines match the expected statuses, refresh-rotation reuse-detection is working end-to-end.

- [ ] **Step 8: Tag the foundation milestone**

```bash
git tag foundation-done
git log --oneline -20
```

The tag `foundation-done` marks the end of sub-project #1. The next sub-project (Auth-extensions or Employee Management, per the decomposition) can be brainstormed against this baseline.

---

## Definition of Done (Foundation overall)

Every item from the spec's §11 must hold:

- [ ] `docker compose up -d` brings MongoDB up healthy.
- [ ] `./dev.sh` boots Backend on `:3000` and Frontend on `:5173`.
- [ ] `http://localhost:3000/health` returns `{"status":"ok"}`.
- [ ] `http://localhost:3000/docs` shows Swagger UI listing `/health` and `/auth/*`.
- [ ] `pnpm seed` creates the admin user; running it again reports "already exists".
- [ ] `pnpm gen:api` regenerates the typed client without errors.
- [ ] At `http://localhost:5173`:
  - [ ] Unauthenticated → `/login`.
  - [ ] Logging in with seeded creds → AppLayout (Sidebar + Topbar with Logo + dropdown + logout).
  - [ ] Each sidebar link renders an `EmptyState`.
  - [ ] Page refresh keeps the session via silent refresh.
  - [ ] Logout returns to `/login`.
- [ ] All foundation smoke tests pass (Backend + Frontend, ~55+ total).
- [ ] Reusing a revoked refresh token returns 401 (verified manually in Task 4 Step 7 + automated in Backend Task 10).
- [ ] Git tags `foundation-backend-done`, `foundation-frontend-done`, and `foundation-done` exist.

When all checkboxes above are checked, Foundation is complete and the project is ready for sub-project #2 (Auth-extensions) or #3 (Employee Management) per the decomposition agreed during brainstorming.
