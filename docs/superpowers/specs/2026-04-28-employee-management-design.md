# Employee Management — Design Spec

**Sub-project:** #3 of the EMS decomposition (after Foundation; Auth-extensions deferred until pre-deploy).
**Date:** 2026-04-28
**Status:** Approved (auto-mode delegation; pending user spec review)

---

## 1. Purpose

Extend the User model with profile data, introduce Department and Position collections, add file uploads (avatar + resume), and ship the HR-facing employee directory + employee detail + department management UIs. Preserve Foundation's auth/security/OpenAPI/orval pipeline — every new endpoint is registered with the existing OpenAPI registry and the FE consumes it via auto-regenerated TanStack Query hooks.

## 2. Scope

### In scope
- Extend `User` with profile fields, `departmentId`, `isActive`.
- New `Department` Mongoose model with HR/Admin CRUD.
- New `Position` Mongoose model representing dated work-history entries.
- `FileStorage` interface + `LocalStorage` implementation.
- Multer-based avatar upload (`image/*`, ≤2 MB) and resume upload (`application/pdf`, ≤5 MB).
- 16 HTTP endpoints under `/employees`, `/departments`, `/positions` (table in §6).
- Field-level visibility: `PublicProfile` (any auth) vs `FullProfile` (self + HR + Admin).
- Frontend pages: Profile (self), People directory, Employee detail, Create employee (HR/Admin), Departments (HR/Admin).
- New shadcn primitives: `table`, `tabs`, `dialog`, `select`, `form`. Upload widgets.
- `<RoleGate>` component for nav/feature gating on the FE.
- Replace placeholder Sidebar links: drop the unused `/messages|/attendance|/expenses|/payroll` placeholder routes from the **employees nav** but keep them as nav stubs for later modules; add `/profile`, `/people`, `/departments` (gated).

### Out of scope (deferred)
- Manager hierarchy / `reportsTo` / org chart visualisation.
- Skills, certifications, training records.
- Performance reviews, onboarding workflows.
- Bank, tax, salary, PII-financial fields — these belong to sub-project #9 Payroll, which will introduce encryption-at-rest at the same time.
- Email invites on employee creation (server logs the temp password at `info` level instead; Auth-extensions sub-project will replace this with real email).
- 2FA, password reset, email verification → sub-project #2.

## 3. Architecture Overview

Two new backend modules: `modules/employees/` and `modules/departments/`. Each follows the Foundation pattern: `*.schema.ts` (Zod + OpenAPI registration), `*.service.ts` (business logic, DB writes, projection helpers), `*.controller.ts` (HTTP layer, validation, response shaping), `*.routes.ts` (router with middleware composition). One new lib: `lib/storage.ts` (FileStorage interface + LocalStorage impl + factory).

Frontend gains a feature folder `features/employees/` containing query hooks (thin wrappers over orval-generated hooks for cache-key consistency), mutation hooks, page components, and the avatar/resume upload widgets. The Profile page also lives there but is mounted at `/profile` (not under `/people`) for self-service ergonomics.

## 4. Data Models

### 4.1 User (extended)

Existing fields preserved (`email`, `passwordHash`, `name`, `role`, `isVerified`, timestamps).

New fields, all optional unless noted:

```ts
{
  // Public profile fields
  jobTitle: string,
  phone: string,                  // formatted, no validation beyond length 7-25
  bio: string,                    // max 500 chars
  avatarUrl: string,              // populated by upload endpoint
  departmentId: ObjectId | null,  // ref Department
  // Sensitive fields (only self + HR + Admin)
  hireDate: Date,
  dateOfBirth: Date,
  address: string,                // single line; max 200 chars
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN",
  emergencyContact: {             // subdocument
    name: string,
    phone: string,
    relationship: string,
  },
  resumeUrl: string,              // populated by upload endpoint
  // Lifecycle
  isActive: boolean,              // required, default true. Soft-delete via deactivate.
}
```

`UserDoc` type widens accordingly. The `select: false` flag stays on `passwordHash`.

### 4.2 Department (new)

```ts
{
  _id: ObjectId,
  name: string,                  // required, unique, trim, max 100
  code: string,                  // required, unique, lowercase, slug-ish [a-z0-9-], max 30
  description: string | null,
  managerId: ObjectId | null,    // ref User
  createdAt, updatedAt,
}
```

Indexes: `name` unique, `code` unique. Trimming and lowercasing applied at schema level for `code`.

### 4.3 Position (new)

```ts
{
  _id: ObjectId,
  userId: ObjectId,              // ref User, indexed
  title: string,
  departmentId: ObjectId | null, // ref Department
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN",
  startedAt: Date,
  endedAt: Date | null,          // null = currently held
  createdAt,
}
```

Indexes: `userId` non-unique, `(userId, endedAt)` for "find current". No DB-level unique constraint on "at most one open position" — enforced in the service layer when adding a new open position (auto-end the prior open one).

## 5. File Storage

### 5.1 Interface (`Backend/src/lib/storage.ts`)

```ts
export interface SavedFile {
  key: string;        // opaque storage key, persisted on User
  url: string;        // public URL the FE renders
  contentType: string;
  size: number;
}

export interface FileStorage {
  save(scope: "avatar" | "resume", userId: string, file: { originalName: string; mimeType: string; buffer: Buffer }): Promise<SavedFile>;
  delete(key: string): Promise<void>;
}

export function createFileStorage(): FileStorage; // factory selects impl by env FILE_STORAGE (default "local")
```

### 5.2 LocalStorage impl

- Files written to `Backend/uploads/<scope>/<userId>-<uuid>.<ext>` where `ext` is derived from `mimeType` via a small map.
- `key` is the relative path (`<scope>/<userId>-<uuid>.<ext>`); `url` is `${PUBLIC_BASE_URL}/files/${key}`.
- `PUBLIC_BASE_URL` defaults to `http://localhost:3000` in dev; env override.
- `delete(key)` is `unlink(uploads/key)`; missing files swallow ENOENT.

### 5.3 Express wiring

`app.ts` adds `app.use("/files", express.static(path.resolve("uploads"), { fallthrough: false }))`. The static dir is gitignored.

### 5.4 Multer

Two named middleware factories: `uploadAvatar` (single file, `image/*` mime check, 2 MB limit) and `uploadResume` (single file, `application/pdf`, 5 MB). Both buffer in memory (`multer.memoryStorage`); the controller hands the buffer to `storage.save(...)`.

## 6. HTTP Endpoints

OpenAPI tags: `employees`, `departments`, `positions`.

| # | Method | Path | Auth | Body / Notes | Returns |
|---|--------|------|------|--------------|---------|
| 1 | GET | `/employees` | any auth | `?q=&department=&page=&limit=` (max 100) | `{ items: PublicProfile[], total, page, limit }` |
| 2 | GET | `/employees/:id` | any auth | — | `PublicProfile` for non-self non-HR; `FullProfile` for self/HR/Admin |
| 3 | POST | `/employees` | HR/Admin | `CreateEmployeeBody` (email, name, role, jobTitle?, departmentId?) | `FullProfile` (server logs temp password at `info`) |
| 4 | PATCH | `/employees/:id` | self (subset) / HR/Admin (full) | `UpdateEmployeeBody`; self subset is `{name, phone, bio, dateOfBirth, address, emergencyContact}` (avatar/resume use dedicated endpoints); service rejects `role`/`departmentId`/`isActive`/`hireDate`/`employmentType`/`jobTitle` changes from non-HR with 403 | `FullProfile` |
| 5 | POST | `/employees/:id/deactivate` | HR/Admin | — | `204` (sets `isActive=false`, ends open position) |
| 6 | POST | `/employees/:id/avatar` | self or HR/Admin | multipart `file` field | `{ avatarUrl }` |
| 7 | DELETE | `/employees/:id/avatar` | self or HR/Admin | — | `204` |
| 8 | POST | `/employees/:id/resume` | self or HR/Admin | multipart `file` field | `{ resumeUrl }` |
| 9 | DELETE | `/employees/:id/resume` | self or HR/Admin | — | `204` |
| 10 | GET | `/employees/:id/positions` | self or HR/Admin | — | `Position[]` desc by `startedAt` |
| 11 | POST | `/employees/:id/positions` | HR/Admin | `CreatePositionBody` (title, departmentId?, employmentType, startedAt, endedAt?) | `Position` (auto-ends prior open position) |
| 12 | PATCH | `/positions/:id` | HR/Admin | `UpdatePositionBody` | `Position` |
| 13 | GET | `/departments` | any auth | `?page=&limit=` | `{ items: Department[], total, page, limit }` |
| 14 | POST | `/departments` | HR/Admin | `CreateDepartmentBody` (name, code, description?, managerId?) | `Department` |
| 15 | PATCH | `/departments/:id` | HR/Admin | `UpdateDepartmentBody` | `Department` |
| 16 | DELETE | `/departments/:id` | Admin only | — | `204` (refuses with 409 if any User references it) |

### Request/response shapes (Zod, registered with OpenAPI)

`PublicProfile = { id, email, name, role, jobTitle?, departmentId?, departmentName?, phone?, avatarUrl?, bio?, isActive }`

`FullProfile = PublicProfile & { hireDate?, dateOfBirth?, address?, employmentType?, emergencyContact?, resumeUrl?, currentPosition?, createdAt, updatedAt }`

`Department = { id, name, code, description?, managerId?, managerName?, employeeCount, createdAt, updatedAt }` (the `employeeCount` and `managerName` are computed by the service via aggregation when listing).

`Position = { id, userId, title, departmentId?, departmentName?, employmentType, startedAt, endedAt? }`

## 7. Permissions

Field-level filtering happens in the service projection helpers — controllers simply call `toPublicProfile(user)` or `toFullProfile(user)` based on requester role and pass-through. Identity check helper: `canSeeFullProfile(req.user, targetUserId) → req.user.role in ["HR","ADMIN"] || req.user.id === targetUserId`.

| Action | EMPLOYEE | PM | HR | ADMIN |
|--------|----------|----|----|-------|
| GET own profile (full) | ✓ | ✓ | ✓ | ✓ |
| GET other employees (public fields) | ✓ | ✓ | ✓ | ✓ |
| GET other employee (full fields) | ✗ | ✗ | ✓ | ✓ |
| Edit own profile (subset: name, phone, bio, avatar, dateOfBirth, address, emergencyContact) | ✓ | ✓ | ✓ | ✓ |
| Edit role / departmentId / isActive | ✗ | ✗ | ✓ | ✓ |
| Create employee | ✗ | ✗ | ✓ | ✓ |
| Deactivate employee | ✗ | ✗ | ✓ | ✓ |
| Manage departments (create/edit) | ✗ | ✗ | ✓ | ✓ |
| Delete department | ✗ | ✗ | ✗ | ✓ |
| Manage work history positions | ✗ | ✗ | ✓ | ✓ |

PM has no special powers in this module yet; treated as EMPLOYEE for visibility. The future Tasks/Project module will give PM elevated rights over their team's task assignments only.

## 8. Frontend Architecture

### 8.1 Routing additions (in `App.tsx`)

```
<Route element={<ProtectedRoute />}>
  <Route element={<AppLayout />}>
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/people" element={<PeopleListPage />} />
    <Route path="/people/new" element={<RoleGate roles={["HR","ADMIN"]}><CreateEmployeePage/></RoleGate>} />
    <Route path="/people/:id" element={<EmployeeDetailPage />} />
    <Route path="/departments" element={<RoleGate roles={["HR","ADMIN"]}><DepartmentsPage/></RoleGate>} />
    {/* existing placeholder routes preserved */}
  </Route>
</Route>
```

### 8.2 Sidebar update

Final Sidebar order, top to bottom:

1. `Profile` — `/profile` (always visible)
2. `People` — `/people` (always visible)
3. `Departments` — `/departments` (HR/Admin only via `<RoleGate>`)
4. *(separator)*
5. `Dashboard` — `/dashboard` (existing placeholder; sub-project #10 fills it)
6. `Tasks` — `/tasks` (disabled-styled stub, label "Coming soon", non-clickable)
7. `Messages` — `/messages` (disabled stub)
8. `Attendance` — `/attendance` (disabled stub)
9. `Expenses` — `/expenses` (disabled stub)
10. `Payroll` — `/payroll` (disabled stub)

The disabled stubs render with `opacity-50 cursor-not-allowed` and don't navigate. Their corresponding routes still exist (with the existing `<EmptyState>` placeholders) for any direct-link traffic.

### 8.3 Components and pages

```
Frontend/src/features/employees/
├── api/
│   └── hooks.ts             # thin wrappers over orval-generated hooks for query-key control
├── components/
│   ├── AvatarUpload.tsx     # avatar drag/drop + crop-free preview
│   ├── ResumeUpload.tsx     # PDF drop zone, shows filename + size
│   ├── EmployeeTable.tsx    # shadcn table, sortable cols, pagination footer
│   ├── EmployeeFilters.tsx  # search input + department select
│   ├── PublicProfileCard.tsx
│   ├── SensitiveProfileSection.tsx  # only mounted when canSeeFull is true
│   └── RoleGate.tsx         # general-purpose role-conditional renderer
├── pages/
│   ├── ProfilePage.tsx      # /profile (self)
│   ├── PeopleListPage.tsx   # /people
│   ├── EmployeeDetailPage.tsx  # /people/:id
│   ├── CreateEmployeePage.tsx  # /people/new
│   └── DepartmentsPage.tsx  # /departments
└── schemas.ts               # Zod schemas for forms (mirror backend Zod via orval-generated types)
```

`AvatarUpload` and `ResumeUpload` use a small `useUploadFile` mutation hook that POSTs multipart to the right endpoint, invalidates `["employee", id]` query, optimistically updates local state on success.

### 8.4 New deps to add (FE)

- `react-hook-form ^7.x`
- `@hookform/resolvers ^3.x`
- shadcn primitives: `table`, `tabs`, `dialog`, `select`, `form` (these are ~9 small files of generated component code, all in `components/ui/`).

No new BE deps beyond `multer` (already a peer concern; will be added).

## 9. Testing

### 9.1 Backend (target: ≥18 new tests)

- `employees.service.test.ts` (unit): projection helpers (`toPublicProfile` strips sensitive; `toFullProfile` includes everything; `canSeeFullProfile` matrix), position auto-end.
- `departments.service.test.ts` (unit): create unique-name conflict, delete-with-employees blocked, employee-count aggregation.
- `storage.test.ts` (unit): LocalStorage save → file written under correct path, delete removes it, missing key on delete is no-op.
- `employees.routes.test.ts` (supertest integration): full flow including `Authorization: Bearer` for `EMPLOYEE` vs `HR`. Cases: list paginated, GET self full vs GET other public, PATCH own subset vs HR full PATCH, EMPLOYEE PATCH role rejected with 403, deactivate cascades to position end, avatar upload → 200 + key on user → DELETE clears it, resume rejects non-PDF with 400, resume rejects 6 MB with 413.
- `departments.routes.test.ts`: HR creates, EMPLOYEE create rejected, dept delete with employees → 409.
- `positions.routes.test.ts`: HR posts new open position, prior open auto-ended, PATCH adjusts dates, GET /employees/:id/positions returns sorted history.

### 9.2 Frontend (target: ≥5 new tests)

- `ProfilePage.test.tsx`: renders own fields, edits bio, save dispatches PATCH.
- `PeopleListPage.test.tsx`: renders rows from mocked list, search filters.
- `RoleGate.test.tsx`: hides children for non-allowed roles.
- `AvatarUpload.test.tsx`: file picker dispatches multipart upload mutation.
- `EmployeeDetailPage.test.tsx`: HR sees `SensitiveProfileSection`; EMPLOYEE viewing other employee does not.

Total project tests target after this sub-project: **~95** (49 + 26 + ~20).

## 10. Definition of Done

- All 16 endpoints registered in OpenAPI; `/docs` lists them under `employees`, `departments`, `positions` tags.
- `pnpm gen:api` regenerates orval client without errors; new modules `employees.ts`, `departments.ts`, `positions.ts` appear under `Frontend/src/api/generated/`.
- Logged in as seeded admin (`admin@sms-ip.local`):
  - `/profile` shows admin's profile, allows editing name/phone/bio, allows uploading an avatar (visible immediately as `<img src=…/files/avatar/…>`).
  - `/people` shows admin in the directory; search by name works.
  - `/people/new` (HR/Admin only) creates a second user (e.g. `alice@sms-ip.local`); server logs the temp password.
  - As that second user (after manual relogin with the logged temp password), `/people/<admin-id>` hides admin's `dateOfBirth` etc.
  - `/departments` (HR/Admin) creates a department; editing an employee's `departmentId` works.
  - Deactivate flow: HR deactivates the second user; the user's row in `/people` is dimmed/marked inactive.
- Backend: `pnpm test` 49 → ~70 passing.
- Frontend: `pnpm test` 26 → ~31 passing.
- Both `tsc --noEmit` clean.
- Both production builds green.
- Git tag `employees-done` exists at the merge commit.

## 11. Open Questions / Assumptions

- **Email invites:** the EMS brief at conversation start implies HR-managed signup ("Authentication: JWT + refresh token, Role-based access" with HR creating users — not self-signup). We're skipping real email here — sub-project #2 Auth-extensions will own that. For now, `POST /employees` server-generates a 16-char random password, hashes it with bcrypt cost 12, and emits one `info`-level log line: `created employee <email> with temp password <plain>`. The HR user can read it from the dev console. **This is unacceptable for production** — the prod cutover plan must replace this with an email send + force-reset-on-first-login flow before deployment.
- **Avatar URL caching:** browsers cache by URL; since we generate a fresh uuid per upload, busting is automatic.
- **Resume PII:** resumes are PDFs that often contain DOB, phone, address. We're not encrypting at rest in this sub-project (storage is local-only for dev). Production deploy plan must document the S3 bucket policy + server-side encryption flag, or move resumes into the same encryption layer Payroll will introduce.
- **`departmentName` and `managerName` fields:** denormalised in the response shape for UI convenience; computed via aggregation, not stored. If perf becomes a concern with many departments, we'll move to materialised view or store the name on User as well.
