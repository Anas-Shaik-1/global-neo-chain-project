# Global NeoChain — Employee Management System

Production-grade Employee Management System (EMS) for the Global NeoChain platform.

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

- Default seeded admin: `admin@global-neochain.local` / value of `SEED_ADMIN_PASSWORD`.
- Access token (15 min) returned in JSON; refresh token (7 days) in `HttpOnly Secure SameSite=Strict` cookie at `Path=/auth`.
- Refresh rotates on every `/auth/refresh`; re-using a stale refresh revokes the entire family.
- Roles: `ADMIN`, `HR`, `EMPLOYEE`, `PM`.

### Auth flow extensions (password reset, force-change, TOTP 2FA)

- **Password reset (`POST /auth/password-reset/request` → `POST /auth/password-reset/confirm`).**
  The request endpoint always returns `204` regardless of whether the email is
  registered, to avoid account-enumeration leaks. **Email delivery is logged to
  the server console only — production deployments must wire a real email
  provider (SES, Postmark, Resend, etc.) before this is usable.** The reset
  link in the log looks like `${FRONTEND_ORIGIN}/reset-password?token=...` and
  expires in 1 hour. Tokens are one-shot and stored as sha256 hashes only.
- **Force-change-password.** Users with `mustChangePassword: true` (HR-created
  accounts, initial seed admin if you flip the flag) are redirected to
  `/change-password` from any authenticated route until they update.
- **TOTP 2FA (opt-in).** Set up at `/security`. After scanning the QR code in
  an authenticator app and verifying once, login switches to a two-step flow:
  `POST /auth/login` returns `{ requires2FA: true }`, then the FE collects the
  6-digit code and calls `POST /auth/login-2fa` to complete. Disabling 2FA
  requires the account password.

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
