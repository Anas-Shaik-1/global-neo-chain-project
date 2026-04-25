# Foundation — Design Spec

**Sub-project:** #1 of the Employee Management System (EMS) decomposition.
**Date:** 2026-04-25
**Status:** Approved (pending user review of this written spec)

---

## 1. Purpose

Establish the technical foundation that every feature sub-project (Auth-extensions, Employee, Tasks, Attendance, Chat, Calls, Expenses, Payroll, Dashboards) builds on. Foundation ships a healthy, runnable, end-to-end vertical slice consisting of:

- TypeScript across both Backend and Frontend.
- shadcn/ui + Tailwind theme with the existing SMS-IP brand identity.
- Redux Toolkit + TanStack Query wired according to the strict separation rules in the project brief (server state in TanStack only, app state in Redux only).
- A code-first OpenAPI pipeline driven from Zod schemas, consumed on the frontend via orval-generated TanStack Query hooks.
- A working JWT auth round trip (login + silent refresh + protected routes) against a seeded admin user.
- An AppLayout shell (sidebar, topbar, content) with placeholder navigation for all future modules.
- Cross-cutting infrastructure: Socket.io namespace stubs, central error handling, structured logging, security middleware, Docker Mongo, dev orchestration, smoke tests.

After Foundation, every feature sub-project should only need to: define its domain models, register routes/schemas with the OpenAPI registry, regenerate the frontend client, build feature-specific UI, and add tests. No feature should need to touch cross-cutting infrastructure.

## 2. Scope

### In scope
- Clean rebuild of `Backend/src/*` and `Frontend/src/*`. Existing SMS-IP `Logo` component and branding strings (`Sehat - Meyer - Sejahtera`, `Indonesian professionals`, HSL color tokens `190/210`) are preserved into the new TS shell.
- Backend: TS, ESM, Zod-OpenAPI, swagger-ui-express, Express 5, Mongoose 8, JWT auth (login + refresh + logout + bootstrap), bcrypt, helmet, rate-limit, cors, pino, Socket.io with `/chat` and `/calls` namespace stubs.
- Frontend: TS, Vite, React 19, Tailwind, shadcn (`new-york`), Redux Toolkit, TanStack Query, orval, axios with auth interceptor, react-router, dark/light theme, AppLayout shell, LoginPage.
- Root-level `docker-compose.yml` for MongoDB and `dev.sh` for concurrent FE+BE.
- Smoke tests on both sides covering the auth happy/sad paths and the `/health` endpoint.

### Out of scope (deferred to later sub-projects)
- Real feature pages (Dashboard charts, Tasks, Chat UI, Attendance, Expenses, Payroll, Employee profiles). Sidebar links exist and route to a shared placeholder `<EmptyState />`.
- Real Socket.io events. Namespaces are stubbed with auth middleware only.
- 2FA, OAuth, password reset, email verification — Auth-extensions sub-project decides.
- Per-feature OpenAPI tags beyond `auth` and `health`.
- Production deployment / CI / secret management.

## 3. Architecture

### 3.1 Repository layout

Two siblings (`Backend/`, `Frontend/`) as separate Node roots, no monorepo workspace tooling. Root-level orchestration only.

```
global-neo-chain-project/
├── docker-compose.yml         # MongoDB
├── dev.sh                     # concurrently runs FE + BE
├── .gitignore
├── docs/superpowers/specs/    # design docs
├── Backend/
│   ├── .env.example
│   ├── package.json           # ESM + TS + scripts
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── server.ts          # http + express + socket.io bootstrap
│       ├── app.ts             # express composition (middleware + routes)
│       ├── config/
│       │   └── index.ts       # env parsed via Zod, fail-fast on bad config
│       ├── db/
│       │   └── index.ts       # mongoose connect + disconnect
│       ├── openapi/
│       │   ├── registry.ts    # zod-openapi registry singleton
│       │   └── spec.ts        # builds + serves /openapi.json + /docs
│       ├── middleware/
│       │   ├── auth.ts        # verifyAccessToken, attaches req.user
│       │   ├── requireRole.ts # role-guard factory
│       │   ├── validate.ts    # validate(schema) -> req.validated
│       │   ├── error.ts       # central error handler
│       │   └── rateLimit.ts   # auth-specific limiter
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── auth.routes.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── auth.service.ts
│       │   │   └── auth.schema.ts
│       │   └── health/
│       │       └── health.routes.ts
│       ├── models/
│       │   ├── user.model.ts
│       │   └── refreshToken.model.ts
│       ├── realtime/
│       │   ├── index.ts       # attach Socket.io to http server
│       │   ├── chat.namespace.ts
│       │   └── calls.namespace.ts
│       ├── lib/
│       │   ├── logger.ts      # pino
│       │   ├── errors.ts      # AppError + subclasses
│       │   └── tokens.ts      # signAccess, signRefresh, verify, jti helpers
│       └── seed.ts            # idempotent admin upsert
└── Frontend/
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── orval.config.ts
    ├── tailwind.config.ts
    ├── components.json        # shadcn
    ├── vitest.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx            # router + provider tree
        ├── api/
        │   ├── generated/     # orval output (gitignored)
        │   └── axios.ts       # axios instance + interceptors
        ├── app/
        │   ├── store.ts       # Redux store, slice registration
        │   └── hooks.ts       # typed useAppDispatch/useAppSelector
        ├── features/
        │   └── auth/
        │       ├── authSlice.ts
        │       ├── LoginPage.tsx
        │       ├── ProtectedRoute.tsx
        │       └── useBootstrapSession.ts
        ├── components/
        │   ├── ui/            # shadcn primitives (button, input, dropdown, ...)
        │   ├── layout/
        │   │   ├── AppLayout.tsx
        │   │   ├── Sidebar.tsx
        │   │   └── Topbar.tsx
        │   ├── brand/
        │   │   └── Logo.tsx   # preserved from existing code
        │   └── common/
        │       └── EmptyState.tsx
        ├── hooks/
        ├── lib/
        │   ├── queryClient.ts
        │   └── theme.ts       # theme provider + ui slice integration
        └── styles/
            └── globals.css    # tailwind + shadcn css vars
```

### 3.2 Provider tree (Frontend `App.tsx`)

```
<ReduxProvider>
  <ThemeProvider>
    <QueryClientProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<EmptyState label="Dashboard" />} />
              <Route path="/tasks" element={<EmptyState label="Tasks" />} />
              <Route path="/messages" element={<EmptyState label="Messages" />} />
              <Route path="/attendance" element={<EmptyState label="Attendance" />} />
              <Route path="/expenses" element={<EmptyState label="Expenses" />} />
              <Route path="/payroll" element={<EmptyState label="Payroll" />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
</ReduxProvider>
```

`useBootstrapSession` runs once at app boot inside `<ProtectedRoute />`, attempts a silent `/auth/refresh`, and gates rendering on the result.

## 4. Auth Flow

### 4.1 Token strategy

- **Access JWT.** 15-minute TTL. Returned in the `POST /auth/login` JSON body. Stored in `authSlice.accessToken` (in-memory only — never persisted, lost on tab close). Sent as `Authorization: Bearer <token>` by the axios interceptor on every request.
- **Refresh JWT.** 7-day TTL. Issued only as `Set-Cookie: refresh=<token>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh`. Never visible to JS. Carries a unique `jti` and a `family` id (rotation).

### 4.2 Endpoints (under `/auth`, OpenAPI tag `auth`)

| Method | Path             | Body                          | Returns                                          | Notes |
|--------|------------------|-------------------------------|--------------------------------------------------|-------|
| POST   | `/auth/login`    | `{ email, password }`         | `{ accessToken, user }` + sets refresh cookie    | rate-limited 5/min |
| POST   | `/auth/refresh`  | (cookie)                      | `{ accessToken }` + rotates refresh cookie       | rotation, reuse-detection |
| POST   | `/auth/logout`   | (cookie)                      | `204`                                            | clears cookie + revokes family |
| GET    | `/auth/me`       | (auth header)                 | `{ user }`                                       | used post-bootstrap |

### 4.3 Refresh rotation & reuse detection

`RefreshToken` collection stores one document per issued refresh token: `{ jti, family, userId, expiresAt, revokedAt | null, replacedBy | null }`. On `POST /auth/refresh`:

1. Verify JWT signature + expiry.
2. Look up by `jti`.
3. If document is revoked → revoke entire `family`, return 401. (Reuse detection: an attacker presenting an old refresh token is treated as a compromise of the family.)
4. Otherwise mark current jti revoked + `replacedBy=newJti`, persist the new jti in the same `family`, set the new refresh cookie, return new access token.

On `POST /auth/logout`: revoke the current family.

### 4.4 Frontend axios interceptor

Request interceptor: read `accessToken` from Redux store, attach `Authorization` header. Response interceptor: on 401 from any URL (except `/auth/refresh` itself), call `/auth/refresh` exactly once; on success, replay original request; on failure, dispatch `authSlice.cleared` and let `<ProtectedRoute />` redirect to `/login`. A module-level promise dedupes concurrent refresh attempts so only one round-trip happens for a burst of 401s.

### 4.5 `useBootstrapSession`

Runs once on first render of `<ProtectedRoute />`. States: `loading` (renders a centered spinner), `authenticated` (renders `<Outlet />`), `unauthenticated` (renders `<Navigate to="/login" />`). Implementation: dispatches a thunk that calls `/auth/refresh` then `/auth/me`; success populates `authSlice`, failure clears it.

## 5. Theming

- **Default:** dark mode, matching the existing `bg-black` brand aesthetic.
- **Light mode:** togglable via `uiSlice.theme`, persisted to `localStorage` under key `ems.theme`. `ThemeProvider` reads on mount and listens for slice changes, sets `class="dark"` on `<html>`.
- **Brand primary:** existing HSL gradient `from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)]`. shadcn theme tokens: `--primary` set to `hsl(200, 85%, 52%)` (midpoint), other tokens derived per shadcn `new-york` defaults adjusted for the cyan family.
- **Typography:** system font stack (no webfonts in Foundation; can revisit with the design module).
- **shadcn primitives installed in Foundation:** `button`, `input`, `label`, `dropdown-menu`, `avatar`, `tooltip`, `separator`, `skeleton`, `sonner` (toast), `card`. Others installed lazily by feature sub-projects as needed.

## 6. Roles

```ts
export const Role = ["ADMIN", "HR", "EMPLOYEE", "PM"] as const;
export type Role = typeof Role[number];
```

- Stored on `User.role` (Mongoose enum).
- Backend: `requireRole(...allowed: Role[])` middleware short-circuits with 403 if `req.user.role` is not in the allowed list.
- Frontend: `<ProtectedRoute roles={["ADMIN"]}>` wrapper performs the same check; if the user is authenticated but lacks the role, renders a 403 `EmptyState` instead of redirecting.
- Foundation does **not** ship per-route role gates (every route is open to any authenticated user). Feature sub-projects layer them on as needed.
- The legacy `GUEST` role is dropped (it was never used).

## 7. Realtime Scaffolding

- `server.ts` constructs `http.createServer(app)` and binds Socket.io to it before `listen`.
- Two namespaces registered: `/chat` and `/calls`, each with an `io.use()` auth middleware that reads the access JWT from `socket.handshake.auth.token` (frontend will pass it from Redux when chat/calls sub-projects ship). Invalid token → `next(new Error("unauthorized"))`.
- Each namespace exposes a single connection handler that logs `socket.id` + `userId` and disconnects gracefully. **No business events are wired in Foundation.**
- CORS for Socket.io configured to `FRONTEND_ORIGIN` only.

## 8. Cross-Cutting Infrastructure

### 8.1 Logger
`pino` with `pino-pretty` transport in dev (`NODE_ENV=development`), JSON in production. Single logger instance exported from `lib/logger.ts`. Express request logging via `pino-http`.

### 8.2 Error handling
- `AppError extends Error` carries `{ statusCode, code, details? }`. Subclasses: `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`.
- Central error middleware (last in the chain) translates:
  - `AppError` → `res.status(statusCode).json({ code, message, details })`.
  - Zod errors → 400 with `result.error.flatten()` under `details`.
  - Mongoose duplicate key (E11000) → 409 with field name.
  - Anything else → 500 `{ code: "INTERNAL", message: "Internal server error" }`, full error logged.
- Frontend mirrors the error envelope. Toast displays `message`; field-level details surfaced inline on forms.

### 8.3 Validation
`validate(schema)` middleware: `schema.safeParse(req.body)`, on failure calls `next(new ValidationError(result.error.flatten()))`, on success attaches `req.validated`. Schemas are Zod objects registered with the OpenAPI registry so they appear in the spec.

### 8.4 Security
- `helmet()` with default config.
- `cors({ origin: FRONTEND_ORIGIN, credentials: true })`.
- `express-rate-limit` on `/auth/*` at 5 req/min/IP. Other routes get a relaxed global limiter at 300 req/min/IP.
- `bcrypt` cost factor 12.
- JWT secret read from env (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`); config layer fails fast if missing.
- Cookies: `Secure` in production, `Secure=false` allowed only when `NODE_ENV=development`.

### 8.5 Config
`config/index.ts` parses `process.env` through a Zod schema. Required vars: `PORT`, `MONGO_URI`, `FRONTEND_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Bad config throws on import → `server.ts` exits before starting.

### 8.6 Seed
`seed.ts` is run via `pnpm seed`. Idempotent: upserts a single user with `role=ADMIN` using credentials from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. Logs whether the user was created or already existed. Safe to run repeatedly.

### 8.7 Testing
- **Backend:** `vitest` + `supertest`. Foundation suite covers:
  - `GET /health` returns 200 `{ status: "ok" }`.
  - `POST /auth/login` with seeded credentials returns 200 + access token + sets refresh cookie.
  - `POST /auth/login` with wrong password returns 401.
  - `POST /auth/refresh` with valid cookie returns new access + rotates cookie.
  - Reusing a revoked refresh token returns 401 and revokes the family.
  - `GET /auth/me` without `Authorization` returns 401; with valid token returns user.
- **Frontend:** `vitest` + React Testing Library. Foundation suite covers:
  - `<LoginPage />` renders, form submits, dispatches login thunk.
  - `<ProtectedRoute />` redirects unauthenticated to `/login`.
  - Axios interceptor refresh-on-401 (mocked).
- Per-feature suites land with each feature sub-project.

## 9. OpenAPI Pipeline

### 9.1 Backend
- `@asteasolutions/zod-to-openapi` (or equivalent `zod-openapi`) maintains a singleton `OpenAPIRegistry`. Each module's `*.schema.ts` registers paths and components.
- `openapi/spec.ts` builds the OpenAPI document at app boot and serves it at `GET /openapi.json` and Swagger UI at `GET /docs`.
- The spec lives only at runtime; no committed `openapi.json`. `pnpm gen:spec` (optional) writes a snapshot for tooling that needs a static file.

### 9.2 Frontend
- `orval.config.ts` points at `http://localhost:3000/openapi.json`.
- `pnpm gen:api` runs orval and writes typed TanStack Query hooks into `Frontend/src/api/generated/` (gitignored). Output organised by tag: `auth.ts`, `health.ts`, etc.
- Hooks consume the shared axios instance from `api/axios.ts` so they pick up auth headers + 401 refresh automatically.
- Generated client uses `withCredentials: true` so the refresh cookie is sent on `/auth/refresh`.

## 10. Data Models

### 10.1 User
```ts
{
  _id: ObjectId,
  email: string,        // unique, lowercased
  passwordHash: string, // bcrypt, select: false
  name: string,
  role: "ADMIN" | "HR" | "EMPLOYEE" | "PM",
  isVerified: boolean,  // reserved; not used in Foundation
  createdAt: Date,
  updatedAt: Date,
}
```

### 10.2 RefreshToken
```ts
{
  _id: ObjectId,
  jti: string,                    // indexed unique
  family: string,                 // indexed
  userId: ObjectId,               // indexed
  expiresAt: Date,                // TTL index
  revokedAt: Date | null,
  replacedBy: string | null,      // jti of the replacement
  createdAt: Date,
}
```

TTL index on `expiresAt` so expired tokens are cleaned automatically.

## 11. Definition of Done

- `docker compose up -d` starts MongoDB on the configured port.
- `./dev.sh` boots Backend on `:3000` and Frontend on `:5173`.
- `http://localhost:3000/health` returns `{ status: "ok" }`.
- `http://localhost:3000/docs` shows Swagger UI listing `/health` and `/auth/*` endpoints.
- `pnpm --dir Backend seed` creates the admin user from env.
- `pnpm --dir Frontend gen:api` regenerates the typed client against the running backend without errors.
- Visiting `http://localhost:5173`:
  - Unauthenticated → redirected to `/login`.
  - Logging in with seeded credentials → `AppLayout` renders (Sidebar with placeholder nav links, Topbar with Logo + profile dropdown + logout).
  - Each sidebar link routes to a `<EmptyState />` placeholder.
  - Page refresh keeps the session via silent refresh.
  - Logout clears state and returns to `/login`.
- All Foundation smoke tests pass on both Backend and Frontend.
- Reusing a revoked refresh token (verified via test) returns 401 and revokes the family.

## 12. Open Questions / Assumptions

- **Package manager:** assumed `pnpm` for both projects. If `npm` is preferred, scripts and lockfiles are equivalent — single find/replace.
- **Node version:** assumed Node 20 LTS or newer.
- **Mongo version:** assumed Mongo 7 via official `mongo:7` Docker image.
- **Branding strings:** preserved verbatim from the existing `App.jsx` (`SMS-IP`, `Sehat - Meyer - Sejahtera`, `Indonesian professionals`). The trailing stray `"` in the existing file is corrected.
- **Brand mark image:** `logo.png` already in `Frontend/public/` is reused as-is.

If any of these assumptions are wrong, fixes are localized — call them out at user-review time.
