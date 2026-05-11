# Leave Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed leave-request feature where any authenticated user can file a request and only `ADMIN` can approve/reject; the owner can cancel a `PENDING` request. Notifications fan out to admins on create and back to the filer on decision.

**Architecture:** New `LeaveRequest` Mongo model + a `Backend/src/modules/leaves/` module mirroring the existing `bugs/expenses` shape (`routes → controller → service → schema`). Frontend gets a single role-aware `/leaves` page under `Frontend/src/features/leaves/`. Reuses the existing `notify`/`notifyMany` helpers from `notifications.service.ts`.

**Tech Stack:** Express 4, Mongoose, Zod, vitest + supertest (backend); React 18, React Query, Zod + react-hook-form, Tailwind/shadcn (frontend).

**Test commands:**
- Single backend file: `pnpm --filter ./Backend test -- <relative-path-to-spec>` from repo root, or `pnpm test <file>` from `Backend/`.
- Frontend typecheck after edits: `pnpm --filter ./Frontend tsc --noEmit`.

---

## File Structure

**Backend (created):**
- `Backend/src/models/leaveRequest.model.ts` — Mongoose model + enums.
- `Backend/src/modules/leaves/leaves.schema.ts` — Zod request/response schemas + OpenAPI registry.
- `Backend/src/modules/leaves/leaves.service.ts` — business logic.
- `Backend/src/modules/leaves/leaves.controller.ts` — thin HTTP layer.
- `Backend/src/modules/leaves/leaves.routes.ts` — Express router with `requireAuth`.
- `Backend/src/modules/leaves/leaves.service.test.ts` — unit tests.
- `Backend/src/modules/leaves/leaves.routes.test.ts` — integration tests.

**Backend (modified):**
- `Backend/src/models/notification.model.ts` — add `LEAVE_SUBMITTED`, `LEAVE_APPROVED`, `LEAVE_REJECTED` kinds.
- `Backend/src/app.ts` — mount `/leaves` router and import its schema for OpenAPI.

**Frontend (created):**
- `Frontend/src/features/leaves/api/hooks.ts` — types + React Query hooks.
- `Frontend/src/features/leaves/components/LeaveStatusBadge.tsx`
- `Frontend/src/features/leaves/components/RequestLeaveDialog.tsx`
- `Frontend/src/features/leaves/components/RejectLeaveDialog.tsx`
- `Frontend/src/features/leaves/components/LeaveRow.tsx`
- `Frontend/src/features/leaves/pages/LeavesPage.tsx`

**Frontend (modified):**
- `Frontend/src/App.tsx` — import + register `/leaves` route under `<ProtectedRoute>`.
- `Frontend/src/components/layout/SidebarNav.tsx` — add `Leaves` entry.

---

## Task 1: Extend notification kinds

**Files:**
- Modify: `Backend/src/models/notification.model.ts`

The existing `NOTIFICATION_KINDS` array is a tuple used both at the Mongoose enum and as a type. Append three new kinds without reordering existing ones so saved notifications stay valid.

- [ ] **Step 1: Edit the enum**

Open `Backend/src/models/notification.model.ts` and append before the closing `] as const;`:

```ts
  // Leave requests
  "LEAVE_SUBMITTED",
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
```

- [ ] **Step 2: Typecheck**

Run from repo root:

```
pnpm --filter ./Backend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Backend/src/models/notification.model.ts
git commit -m "feat(notifications): add LEAVE_* notification kinds"
```

---

## Task 2: Create the `LeaveRequest` Mongoose model

**Files:**
- Create: `Backend/src/models/leaveRequest.model.ts`

- [ ] **Step 1: Write the file**

```ts
import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/**
 * Typed leave request — single record per request, no balances, no
 * half-day support. `startDate` / `endDate` are stored at UTC midnight so
 * day-precision overlap checks aren't skewed by client timezone.
 *
 * Only ADMINs can decide; the owner can cancel while still PENDING.
 */
const leaveRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },
    decisionById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decisionAt: { type: Date, default: null },
    decisionNotes: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

// Lists the user's own requests, newest first.
leaveRequestSchema.index({ userId: 1, status: 1 });
// Admin queue: PENDING by startDate ascending so the soonest surface first.
leaveRequestSchema.index({ status: 1, startDate: 1 });

export type LeaveRequestDoc = InferSchemaType<typeof leaveRequestSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type LeaveRequestModel = Model<LeaveRequestDoc>;

export const LeaveRequest: LeaveRequestModel = model<LeaveRequestDoc>(
  "LeaveRequest",
  leaveRequestSchema,
);
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Backend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Backend/src/models/leaveRequest.model.ts
git commit -m "feat(models): add LeaveRequest model"
```

---

## Task 3: Write the Zod schemas + OpenAPI registry

**Files:**
- Create: `Backend/src/modules/leaves/leaves.schema.ts`

This mirrors the layout of `bugs.schema.ts` — request bodies, response shapes, list-query schema, and `registry.registerPath` blocks for each endpoint. The frontend will reuse `LEAVE_TYPES` / `LEAVE_STATUSES` directly from this file's runtime export (re-declared on the frontend) so keep the names identical.

- [ ] **Step 1: Write the file**

```ts
import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import {
  LEAVE_STATUSES,
  LEAVE_TYPES,
} from "../../models/leaveRequest.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const LeaveResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    type: z.enum(LEAVE_TYPES),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string(),
    status: z.enum(LEAVE_STATUSES),
    decisionById: z.string().nullable(),
    decisionByName: z.string().nullable(),
    decisionAt: z.string().nullable(),
    decisionNotes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("LeaveRequest");

export const PagedLeavesResponse = z
  .object({
    items: z.array(LeaveResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  })
  .openapi("PagedLeavesResponse");

export const CreateLeaveBody = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim().min(1).max(500),
  })
  .openapi("CreateLeaveBody");

export const RejectLeaveBody = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .openapi("RejectLeaveBody");

export const ListLeavesQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(LEAVE_STATUSES).optional(),
  type: z.enum(LEAVE_TYPES).optional(),
  userId: objectIdString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});
const ErrorResponse = z
  .object({ code: z.string(), message: z.string() })
  .openapi("LeaveErrorResponse");

const tag = "leaves";
const sec = [{ bearerAuth: [] }];

registry.registerPath({
  method: "post",
  path: "/leaves",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateLeaveBody } } } },
  responses: {
    201: { description: "Leave created", ...json(LeaveResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
    409: { description: "Overlaps an existing request", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "get",
  path: "/leaves/mine",
  tags: [tag],
  security: sec,
  responses: { 200: { description: "Own leaves", ...json(PagedLeavesResponse) } },
});

registry.registerPath({
  method: "get",
  path: "/leaves",
  tags: [tag],
  security: sec,
  request: { query: ListLeavesQuery },
  responses: {
    200: { description: "All leaves (admin)", ...json(PagedLeavesResponse) },
    403: { description: "Admins only", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/leaves/{id}/cancel",
  tags: [tag],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Cancelled", ...json(LeaveResponse) },
    403: { description: "Not the owner", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
    409: { description: "Already decided/cancelled", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/leaves/{id}/approve",
  tags: [tag],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Approved", ...json(LeaveResponse) },
    403: { description: "Admins only", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
    409: { description: "Already decided/cancelled", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/leaves/{id}/reject",
  tags: [tag],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: RejectLeaveBody } } },
  },
  responses: {
    200: { description: "Rejected", ...json(LeaveResponse) },
    403: { description: "Admins only", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
    409: { description: "Already decided/cancelled", ...json(ErrorResponse) },
  },
});
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Backend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Backend/src/modules/leaves/leaves.schema.ts
git commit -m "feat(leaves): add Zod + OpenAPI schemas"
```

---

## Task 4: Write the service unit tests (TDD)

**Files:**
- Create: `Backend/src/modules/leaves/leaves.service.test.ts`

The service file does not exist yet — these tests will fail until Task 5 lands.

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

vi.mock("../notifications/notifications.service.js", () => ({
  notify: vi.fn(async () => ({})),
  notifyMany: vi.fn(async () => []),
}));

beforeAll(async () => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});

async function seedUser(role: "ADMIN" | "HR" | "EMPLOYEE", email: string) {
  const bcrypt = (await import("bcrypt")).default;
  const { User } = await import("../../models/user.model.js");
  const u = await User.create({
    email,
    name: email,
    role,
    passwordHash: await bcrypt.hash("pw", 4),
  });
  return u._id.toString();
}

function today(offset = 0): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe("leaves.service", () => {
  it("createLeave persists a PENDING request and notifies admins", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    await seedUser("ADMIN", "admin@b.com");
    const { notifyMany } = await import("../notifications/notifications.service.js");
    const svc = await import("./leaves.service.js");

    const created = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "ok" },
    );

    expect(created.status).toBe("PENDING");
    expect(created.type).toBe("CASUAL");
    expect(created.userId).toBe(me);
    expect(notifyMany).toHaveBeenCalledTimes(1);
  });

  it("createLeave rejects past start dates", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const svc = await import("./leaves.service.js");
    await expect(
      svc.createLeave(
        { id: me, role: "EMPLOYEE" },
        { type: "CASUAL", startDate: today(-1), endDate: today(1), reason: "x" },
      ),
    ).rejects.toThrow(/past/i);
  });

  it("createLeave rejects inverted date range", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const svc = await import("./leaves.service.js");
    await expect(
      svc.createLeave(
        { id: me, role: "EMPLOYEE" },
        { type: "CASUAL", startDate: today(5), endDate: today(2), reason: "x" },
      ),
    ).rejects.toThrow(/range/i);
  });

  it("createLeave rejects overlapping pending request", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const svc = await import("./leaves.service.js");
    await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(5), reason: "a" },
    );
    await expect(
      svc.createLeave(
        { id: me, role: "EMPLOYEE" },
        { type: "SICK", startDate: today(3), endDate: today(7), reason: "b" },
      ),
    ).rejects.toThrow(/overlap/i);
  });

  it("approveLeave moves PENDING → APPROVED and notifies the filer", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const admin = await seedUser("ADMIN", "admin@b.com");
    const { notify } = await import("../notifications/notifications.service.js");
    const svc = await import("./leaves.service.js");

    const created = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "x" },
    );
    const approved = await svc.approveLeave(created.id, { id: admin, role: "ADMIN" });

    expect(approved.status).toBe("APPROVED");
    expect(approved.decisionById).toBe(admin);
    expect(approved.decisionAt).not.toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("rejectLeave stores notes and notifies the filer", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const admin = await seedUser("ADMIN", "admin@b.com");
    const svc = await import("./leaves.service.js");

    const created = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "x" },
    );
    const rejected = await svc.rejectLeave(
      created.id,
      { id: admin, role: "ADMIN" },
      { notes: "too short notice" },
    );

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.decisionNotes).toBe("too short notice");
  });

  it("approveLeave is forbidden for non-admin", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const other = await seedUser("HR", "hr@b.com");
    const svc = await import("./leaves.service.js");
    const created = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "x" },
    );
    await expect(
      svc.approveLeave(created.id, { id: other, role: "HR" }),
    ).rejects.toThrow(/forbidden|admin/i);
  });

  it("approveLeave rejects non-PENDING transitions", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const admin = await seedUser("ADMIN", "admin@b.com");
    const svc = await import("./leaves.service.js");
    const created = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "x" },
    );
    await svc.approveLeave(created.id, { id: admin, role: "ADMIN" });
    await expect(
      svc.approveLeave(created.id, { id: admin, role: "ADMIN" }),
    ).rejects.toThrow(/pending/i);
  });

  it("cancelLeave only works for the owner on PENDING", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const other = await seedUser("EMPLOYEE", "other@b.com");
    const svc = await import("./leaves.service.js");
    const created = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "x" },
    );
    await expect(
      svc.cancelLeave(created.id, { id: other, role: "EMPLOYEE" }),
    ).rejects.toThrow(/forbidden|owner/i);
    const cancelled = await svc.cancelLeave(created.id, { id: me, role: "EMPLOYEE" });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("listMine returns my requests newest-first", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const svc = await import("./leaves.service.js");
    await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(10), endDate: today(11), reason: "first" },
    );
    await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "SICK", startDate: today(20), endDate: today(21), reason: "second" },
    );
    const page = await svc.listMineLeaves(me, {});
    expect(page.items.length).toBe(2);
    expect(page.items[0]!.reason).toBe("second");
  });

  it("listAll is forbidden for non-admin", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const svc = await import("./leaves.service.js");
    await expect(svc.listAllLeaves({ id: me, role: "EMPLOYEE" }, {})).rejects.toThrow(
      /forbidden|admin/i,
    );
  });

  it("listAll filters by status", async () => {
    const me = await seedUser("EMPLOYEE", "e@b.com");
    const admin = await seedUser("ADMIN", "admin@b.com");
    const svc = await import("./leaves.service.js");
    const a = await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "CASUAL", startDate: today(1), endDate: today(2), reason: "x" },
    );
    await svc.createLeave(
      { id: me, role: "EMPLOYEE" },
      { type: "SICK", startDate: today(5), endDate: today(6), reason: "y" },
    );
    await svc.approveLeave(a.id, { id: admin, role: "ADMIN" });
    const pending = await svc.listAllLeaves({ id: admin, role: "ADMIN" }, { status: "PENDING" });
    expect(pending.items.length).toBe(1);
    expect(pending.items[0]!.status).toBe("PENDING");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (file doesn't exist yet)**

```
pnpm --filter ./Backend test -- src/modules/leaves/leaves.service.test.ts
```

Expected: every test fails with module-not-found or function-not-defined.

- [ ] **Step 3: Commit**

```bash
git add Backend/src/modules/leaves/leaves.service.test.ts
git commit -m "test(leaves): add service unit tests (failing)"
```

---

## Task 5: Implement the service

**Files:**
- Create: `Backend/src/modules/leaves/leaves.service.ts`

- [ ] **Step 1: Write the service**

```ts
import { Types } from "mongoose";
import {
  LeaveRequest,
  type LeaveRequestDoc,
  type LeaveStatus,
  type LeaveType,
} from "../../models/leaveRequest.model.js";
import { User, type Role } from "../../models/user.model.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notify, notifyMany } from "../notifications/notifications.service.js";

export interface PublicLeave {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  decisionById: string | null;
  decisionByName: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Actor {
  id: string;
  role: Role;
}

function toUtcMidnight(iso: string): Date {
  // `iso` is YYYY-MM-DD per Zod schema; build a UTC-midnight Date.
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ValidationError("Invalid date");
  return d;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

interface UserStub {
  id: string;
  name: string | null;
  email: string | null;
}

async function loadUsers(ids: Types.ObjectId[]): Promise<Map<string, UserStub>> {
  const unique = Array.from(new Set(ids.map((i) => i.toString())));
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select({ name: 1, email: 1 })
    .lean();
  const map = new Map<string, UserStub>();
  for (const u of users) {
    map.set(u._id.toString(), {
      id: u._id.toString(),
      name: u.name ?? null,
      email: u.email ?? null,
    });
  }
  return map;
}

function toPublic(doc: LeaveRequestDoc, users: Map<string, UserStub>): PublicLeave {
  const owner = users.get(doc.userId.toString()) ?? null;
  const decider = doc.decisionById
    ? users.get(doc.decisionById.toString()) ?? null
    : null;
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    userName: owner?.name ?? null,
    userEmail: owner?.email ?? null,
    type: doc.type as LeaveType,
    startDate: doc.startDate.toISOString().slice(0, 10),
    endDate: doc.endDate.toISOString().slice(0, 10),
    reason: doc.reason,
    status: doc.status as LeaveStatus,
    decisionById: doc.decisionById ? doc.decisionById.toString() : null,
    decisionByName: decider?.name ?? null,
    decisionAt: doc.decisionAt ? doc.decisionAt.toISOString() : null,
    decisionNotes: doc.decisionNotes ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function requireDoc(id: string): Promise<LeaveRequestDoc> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Leave");
  const doc = await LeaveRequest.findById(id);
  if (!doc) throw new NotFoundError("Leave");
  return doc;
}

function ensureAdmin(actor: Actor): void {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Admins only");
}

export interface CreateLeaveInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function createLeave(
  actor: Actor,
  input: CreateLeaveInput,
): Promise<PublicLeave> {
  const start = toUtcMidnight(input.startDate);
  const end = toUtcMidnight(input.endDate);
  if (end < start) throw new ValidationError("Invalid date range");
  if (start < todayUtc()) throw new ValidationError("Start date is in the past");

  const overlap = await LeaveRequest.exists({
    userId: new Types.ObjectId(actor.id),
    status: { $in: ["PENDING", "APPROVED"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) {
    throw new ConflictError("Overlaps an existing leave request");
  }

  const created = await LeaveRequest.create({
    userId: new Types.ObjectId(actor.id),
    type: input.type,
    startDate: start,
    endDate: end,
    reason: input.reason,
    status: "PENDING",
  });

  // Fan-out notification to all active admins. Best-effort; never block the
  // primary create on a notification failure.
  try {
    const admins = await User.find({ role: "ADMIN", isActive: true })
      .select({ _id: 1 })
      .lean();
    if (admins.length > 0) {
      const owner = await User.findById(actor.id).select({ name: 1 }).lean();
      await notifyMany(
        admins.map((a) => a._id.toString()),
        {
          kind: "LEAVE_SUBMITTED",
          title: `New leave request from ${owner?.name ?? "an employee"}`,
          body: `${input.type} · ${input.startDate} → ${input.endDate}`,
          link: "/leaves",
        },
      );
    }
  } catch (err) {
    logger.warn({ err }, "leaves: admin notify on create failed");
  }

  const users = await loadUsers([created.userId]);
  return toPublic(created, users);
}

export async function approveLeave(id: string, actor: Actor): Promise<PublicLeave> {
  ensureAdmin(actor);
  const doc = await requireDoc(id);
  if (doc.status !== "PENDING") {
    throw new ConflictError("Leave is no longer pending");
  }
  doc.status = "APPROVED";
  doc.decisionById = new Types.ObjectId(actor.id);
  doc.decisionAt = new Date();
  doc.decisionNotes = null;
  await doc.save();

  try {
    await notify(doc.userId.toString(), {
      kind: "LEAVE_APPROVED",
      title: "Leave request approved",
      body: `${doc.type} · ${doc.startDate.toISOString().slice(0, 10)} → ${doc.endDate
        .toISOString()
        .slice(0, 10)}`,
      link: "/leaves",
    });
  } catch (err) {
    logger.warn({ err }, "leaves: filer notify on approve failed");
  }

  const users = await loadUsers([doc.userId, doc.decisionById]);
  return toPublic(doc, users);
}

export interface RejectInput {
  notes?: string;
}

export async function rejectLeave(
  id: string,
  actor: Actor,
  input: RejectInput,
): Promise<PublicLeave> {
  ensureAdmin(actor);
  const doc = await requireDoc(id);
  if (doc.status !== "PENDING") {
    throw new ConflictError("Leave is no longer pending");
  }
  doc.status = "REJECTED";
  doc.decisionById = new Types.ObjectId(actor.id);
  doc.decisionAt = new Date();
  doc.decisionNotes = input.notes ?? null;
  await doc.save();

  try {
    await notify(doc.userId.toString(), {
      kind: "LEAVE_REJECTED",
      title: "Leave request rejected",
      body: input.notes ? input.notes : `${doc.type} request was rejected`,
      link: "/leaves",
    });
  } catch (err) {
    logger.warn({ err }, "leaves: filer notify on reject failed");
  }

  const users = await loadUsers([doc.userId, doc.decisionById]);
  return toPublic(doc, users);
}

export async function cancelLeave(id: string, actor: Actor): Promise<PublicLeave> {
  const doc = await requireDoc(id);
  if (doc.userId.toString() !== actor.id) {
    throw new ForbiddenError("Only the owner can cancel");
  }
  if (doc.status !== "PENDING") {
    throw new ConflictError("Leave is no longer pending");
  }
  doc.status = "CANCELLED";
  await doc.save();
  const users = await loadUsers([doc.userId]);
  return toPublic(doc, users);
}

export interface ListInput {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  type?: LeaveType;
  userId?: string;
  from?: string;
  to?: string;
}

interface Page {
  items: PublicLeave[];
  total: number;
  page: number;
  limit: number;
}

function pageParams(input: ListInput): { page: number; limit: number; skip: number } {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  return { page, limit, skip: (page - 1) * limit };
}

export async function listMineLeaves(userId: string, input: ListInput): Promise<Page> {
  const { page, limit, skip } = pageParams(input);
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (input.status) filter.status = input.status;
  if (input.type) filter.type = input.type;
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  const users = await loadUsers(
    items.flatMap((d) => [d.userId, d.decisionById].filter(Boolean) as Types.ObjectId[]),
  );
  return { items: items.map((d) => toPublic(d, users)), total, page, limit };
}

export async function listAllLeaves(actor: Actor, input: ListInput): Promise<Page> {
  ensureAdmin(actor);
  const { page, limit, skip } = pageParams(input);
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.type) filter.type = input.type;
  if (input.userId) filter.userId = new Types.ObjectId(input.userId);
  if (input.from || input.to) {
    const from = input.from ? toUtcMidnight(input.from) : null;
    const to = input.to ? toUtcMidnight(input.to) : null;
    // intersection: [startDate, endDate] overlaps [from, to]
    if (from) (filter as Record<string, unknown>).endDate = { $gte: from };
    if (to) (filter as Record<string, unknown>).startDate = { $lte: to };
  }
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  const users = await loadUsers(
    items.flatMap((d) => [d.userId, d.decisionById].filter(Boolean) as Types.ObjectId[]),
  );
  return { items: items.map((d) => toPublic(d, users)), total, page, limit };
}
```

- [ ] **Step 2: Run the service tests**

```
pnpm --filter ./Backend test -- src/modules/leaves/leaves.service.test.ts
```

Expected: all tests pass. If any fail, read the error, fix the service (not the test).

- [ ] **Step 3: Commit**

```bash
git add Backend/src/modules/leaves/leaves.service.ts
git commit -m "feat(leaves): implement service (create/decide/cancel/list)"
```

---

## Task 6: Add the controller

**Files:**
- Create: `Backend/src/modules/leaves/leaves.controller.ts`

- [ ] **Step 1: Write the file**

```ts
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./leaves.service.js";
import { CreateLeaveBody, RejectLeaveBody } from "./leaves.schema.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import type { LeaveStatus, LeaveType } from "../../models/leaveRequest.model.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function readPaging(req: Request) {
  return {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof CreateLeaveBody>;
    const created = await svc.createLeave(
      { id: me.id, role: me.role },
      body,
    );
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const { page, limit } = readPaging(req);
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as LeaveStatus)
        : undefined;
    const type =
      typeof req.query.type === "string" ? (req.query.type as LeaveType) : undefined;
    const result = await svc.listMineLeaves(me.id, { page, limit, status, type });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const { page, limit } = readPaging(req);
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as LeaveStatus)
        : undefined;
    const type =
      typeof req.query.type === "string" ? (req.query.type as LeaveType) : undefined;
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const result = await svc.listAllLeaves(
      { id: me.id, role: me.role },
      { page, limit, status, type, userId, from, to },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function patchApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const updated = await svc.approveLeave(id, { id: me.id, role: me.role });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function patchReject(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const body = req.validated as z.infer<typeof RejectLeaveBody>;
    const updated = await svc.rejectLeave(
      id,
      { id: me.id, role: me.role },
      { notes: body.notes },
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function patchCancel(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const updated = await svc.cancelLeave(id, { id: me.id, role: me.role });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Backend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Backend/src/modules/leaves/leaves.controller.ts
git commit -m "feat(leaves): add HTTP controller"
```

---

## Task 7: Add the router and wire it into `app.ts`

**Files:**
- Create: `Backend/src/modules/leaves/leaves.routes.ts`
- Modify: `Backend/src/app.ts`

- [ ] **Step 1: Write the router**

`Backend/src/modules/leaves/leaves.routes.ts`:

```ts
import { Router } from "express";
import * as ctl from "./leaves.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { CreateLeaveBody, RejectLeaveBody } from "./leaves.schema.js";

export const leavesRouter = Router();

// All endpoints require auth. Service layer enforces ADMIN-only on
// approve / reject / list-all, and owner-only on cancel.
leavesRouter.use(requireAuth);

leavesRouter.get("/mine", ctl.getMine);
leavesRouter.get("/", ctl.getAll);
leavesRouter.post("/", validate(CreateLeaveBody), ctl.postCreate);
leavesRouter.patch("/:id/approve", ctl.patchApprove);
leavesRouter.patch("/:id/reject", validate(RejectLeaveBody), ctl.patchReject);
leavesRouter.patch("/:id/cancel", ctl.patchCancel);
```

- [ ] **Step 2: Wire into `app.ts`**

Edit `Backend/src/app.ts`. Add two import lines near the other module imports (alphabetical-ish, alongside `bugs`):

```ts
import { leavesRouter } from "./modules/leaves/leaves.routes.js";
```

And the side-effect schema import alongside the others:

```ts
import "./modules/leaves/leaves.schema.js";
```

Then register the router with the others. Add this line after the `/bugs` mount:

```ts
  app.use("/leaves", leavesRouter);
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter ./Backend tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/modules/leaves/leaves.routes.ts Backend/src/app.ts
git commit -m "feat(leaves): mount /leaves router"
```

---

## Task 8: Route integration tests

**Files:**
- Create: `Backend/src/modules/leaves/leaves.routes.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import request from "supertest";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

beforeAll(async () => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

async function seedAndToken(role: "ADMIN" | "HR" | "EMPLOYEE", email: string) {
  const { User } = await import("../../models/user.model.js");
  const u = await User.create({
    email,
    name: email,
    role,
    passwordHash: await bcrypt.hash("pw", 4),
  });
  const { signAccessToken } = await import("../../lib/tokens.js");
  return {
    id: u._id.toString(),
    token: signAccessToken({ sub: u._id.toString(), role, isProjectManager: false }),
  };
}

function future(offset: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe("/leaves", () => {
  it("happy path: employee creates, admin approves, filer sees APPROVED", async () => {
    const emp = await seedAndToken("EMPLOYEE", "e@b.com");
    const admin = await seedAndToken("ADMIN", "admin@b.com");
    const app = await buildApp();

    const create = await request(app)
      .post("/leaves")
      .set("Authorization", `Bearer ${emp.token}`)
      .send({ type: "CASUAL", startDate: future(1), endDate: future(2), reason: "ok" });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const approve = await request(app)
      .patch(`/leaves/${id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe("APPROVED");

    const mine = await request(app)
      .get("/leaves/mine")
      .set("Authorization", `Bearer ${emp.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.items[0].status).toBe("APPROVED");
  });

  it("non-admin gets 403 on /approve", async () => {
    const emp = await seedAndToken("EMPLOYEE", "e@b.com");
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();

    const create = await request(app)
      .post("/leaves")
      .set("Authorization", `Bearer ${emp.token}`)
      .send({ type: "CASUAL", startDate: future(1), endDate: future(2), reason: "ok" });
    expect(create.status).toBe(201);

    const approve = await request(app)
      .patch(`/leaves/${create.body.id}/approve`)
      .set("Authorization", `Bearer ${hr.token}`);
    expect(approve.status).toBe(403);
  });

  it("non-owner cannot cancel", async () => {
    const emp = await seedAndToken("EMPLOYEE", "e@b.com");
    const other = await seedAndToken("EMPLOYEE", "other@b.com");
    const app = await buildApp();

    const create = await request(app)
      .post("/leaves")
      .set("Authorization", `Bearer ${emp.token}`)
      .send({ type: "CASUAL", startDate: future(1), endDate: future(2), reason: "ok" });

    const cancel = await request(app)
      .patch(`/leaves/${create.body.id}/cancel`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(cancel.status).toBe(403);
  });

  it("rejects past start dates with 400", async () => {
    const emp = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const create = await request(app)
      .post("/leaves")
      .set("Authorization", `Bearer ${emp.token}`)
      .send({ type: "CASUAL", startDate: future(-1), endDate: future(1), reason: "ok" });
    expect(create.status).toBe(400);
  });

  it("rejects overlapping requests with 409", async () => {
    const emp = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const ok = await request(app)
      .post("/leaves")
      .set("Authorization", `Bearer ${emp.token}`)
      .send({ type: "CASUAL", startDate: future(1), endDate: future(5), reason: "a" });
    expect(ok.status).toBe(201);

    const dup = await request(app)
      .post("/leaves")
      .set("Authorization", `Bearer ${emp.token}`)
      .send({ type: "SICK", startDate: future(3), endDate: future(6), reason: "b" });
    expect(dup.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the route tests**

```
pnpm --filter ./Backend test -- src/modules/leaves/leaves.routes.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add Backend/src/modules/leaves/leaves.routes.test.ts
git commit -m "test(leaves): add route integration tests"
```

---

## Task 9: Frontend API hooks

**Files:**
- Create: `Frontend/src/features/leaves/api/hooks.ts`

- [ ] **Step 1: Write the file**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

const api = () => getApi();

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface Leave {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  decisionById: string | null;
  decisionByName: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedLeaves {
  items: Leave[];
  total: number;
  page: number;
  limit: number;
}

export const leaveKeys = {
  all: ["leaves"] as const,
  mine: (params: Record<string, unknown> = {}) => ["leaves", "mine", params] as const,
  list: (params: Record<string, unknown> = {}) => ["leaves", "all", params] as const,
};

export interface ListParams {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  type?: LeaveType;
  userId?: string;
  from?: string;
  to?: string;
}

export function useMyLeaves(params: ListParams = {}) {
  return useQuery({
    queryKey: leaveKeys.mine(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/leaves/mine", { params });
      return res.data as PagedLeaves;
    },
  });
}

export function useAllLeaves(params: ListParams = {}) {
  return useQuery({
    queryKey: leaveKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/leaves", { params });
      return res.data as PagedLeaves;
    },
  });
}

export interface CreateLeaveInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLeaveInput) => {
      const res = await api().post("/leaves", input);
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave request submitted");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not submit request")),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api().patch(`/leaves/${id}/cancel`);
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave cancelled");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not cancel")),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api().patch(`/leaves/${id}/approve`);
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave approved");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not approve")),
  });
}

export interface RejectInput {
  id: string;
  notes?: string;
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: RejectInput) => {
      const res = await api().patch(`/leaves/${id}/reject`, { notes });
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not reject")),
  });
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/features/leaves/api/hooks.ts
git commit -m "feat(leaves-fe): add React Query hooks + types"
```

---

## Task 10: `LeaveStatusBadge` component

**Files:**
- Create: `Frontend/src/features/leaves/components/LeaveStatusBadge.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { StatusBadge } from "@/components/common/StatusBadge";
import type { LeaveStatus } from "../api/hooks";

const TONE: Record<LeaveStatus, "warn" | "info" | "success" | "danger" | "default"> = {
  PENDING: "warn",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
};

const LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <StatusBadge tone={TONE[status]}>{LABEL[status]}</StatusBadge>;
}
```

- [ ] **Step 2: Verify `StatusBadge` accepts the `tone` values used above**

```
grep -n "tone" Frontend/src/components/common/StatusBadge.tsx | head -10
```

If `danger` is not a supported tone, fall back to `"warn"` for REJECTED (still readable). Update the map accordingly. If `default` is not supported either, use the omission-of-tone variant (drop the prop for that case).

- [ ] **Step 3: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/features/leaves/components/LeaveStatusBadge.tsx
git commit -m "feat(leaves-fe): add LeaveStatusBadge"
```

---

## Task 11: `RequestLeaveDialog` component

**Files:**
- Create: `Frontend/src/features/leaves/components/RequestLeaveDialog.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_TYPES, useCreateLeave, type LeaveType } from "../api/hooks";

const Schema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
    reason: z.string().trim().min(1, "A reason is required").max(500),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "End date must be on or after start date",
  });

type Values = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestLeaveDialog({ open, onOpenChange }: Props) {
  const create = useCreateLeave();
  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { type: "CASUAL" as LeaveType, startDate: "", endDate: "", reason: "" },
  });

  useEffect(() => {
    if (open) form.reset({ type: "CASUAL", startDate: "", endDate: "", reason: "" });
  }, [open, form]);

  async function onSubmit(values: Values) {
    await create.mutateAsync(values);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Pick the type, dates, and a short reason. Admins are notified
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label htmlFor="type">Type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v as LeaveType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
              {form.formState.errors.startDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startDate.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">End</Label>
              <Input id="endDate" type="date" {...form.register("endDate")} />
              {form.formState.errors.endDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.endDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" rows={3} {...form.register("reason")} />
            {form.formState.errors.reason ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.reason.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean. If the `<Select>` import path differs in this repo (e.g., a wrapper), open `Frontend/src/components/ui/select.tsx` and adjust imports — the surface should match shadcn's stock Select.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/features/leaves/components/RequestLeaveDialog.tsx
git commit -m "feat(leaves-fe): add RequestLeaveDialog"
```

---

## Task 12: `RejectLeaveDialog` component

**Files:**
- Create: `Frontend/src/features/leaves/components/RejectLeaveDialog.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRejectLeave } from "../api/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveId: string | null;
}

export function RejectLeaveDialog({ open, onOpenChange, leaveId }: Props) {
  const reject = useRejectLeave();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) setNotes("");
  }, [open]);

  async function onSubmit() {
    if (!leaveId) return;
    await reject.mutateAsync({ id: leaveId, notes: notes.trim() || undefined });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject leave request</DialogTitle>
          <DialogDescription>
            Optionally add a short note for the requester. They'll see it on
            their list and in the notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-notes">Notes (optional)</Label>
          <Textarea
            id="reject-notes"
            rows={3}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onSubmit}
            disabled={reject.isPending || !leaveId}
          >
            {reject.isPending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/features/leaves/components/RejectLeaveDialog.tsx
git commit -m "feat(leaves-fe): add RejectLeaveDialog"
```

---

## Task 13: `LeaveRow` shared row

**Files:**
- Create: `Frontend/src/features/leaves/components/LeaveRow.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApproveLeave, useCancelLeave, type Leave } from "../api/hooks";
import { LeaveStatusBadge } from "./LeaveStatusBadge";

interface Props {
  leave: Leave;
  /** "admin" exposes Approve/Reject; "mine" exposes Cancel. */
  variant: "admin" | "mine";
  onRejectClick?: (id: string) => void;
}

export function LeaveRow({ leave, variant, onRejectClick }: Props) {
  const approve = useApproveLeave();
  const cancel = useCancelLeave();

  return (
    <TableRow>
      {variant === "admin" ? (
        <TableCell>
          <div className="font-medium">{leave.userName ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{leave.userEmail ?? ""}</div>
        </TableCell>
      ) : null}
      <TableCell>{leave.type.charAt(0) + leave.type.slice(1).toLowerCase()}</TableCell>
      <TableCell>{leave.startDate}</TableCell>
      <TableCell>{leave.endDate}</TableCell>
      <TableCell className="max-w-xs truncate" title={leave.reason}>
        {leave.reason}
      </TableCell>
      <TableCell>
        <LeaveStatusBadge status={leave.status} />
        {leave.status === "REJECTED" && leave.decisionNotes ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {leave.decisionNotes}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        {variant === "admin" && leave.status === "PENDING" ? (
          <div className="inline-flex gap-2">
            <Button
              size="sm"
              onClick={() => approve.mutate(leave.id)}
              disabled={approve.isPending}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRejectClick?.(leave.id)}
            >
              Reject
            </Button>
          </div>
        ) : null}
        {variant === "mine" && leave.status === "PENDING" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancel.mutate(leave.id)}
            disabled={cancel.isPending}
          >
            Cancel
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/features/leaves/components/LeaveRow.tsx
git commit -m "feat(leaves-fe): add LeaveRow shared row"
```

---

## Task 14: `LeavesPage` (role-aware page)

**Files:**
- Create: `Frontend/src/features/leaves/pages/LeavesPage.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector } from "@/app/hooks";
import {
  useAllLeaves,
  useMyLeaves,
  LEAVE_STATUSES,
  type LeaveStatus,
} from "../api/hooks";
import { RequestLeaveDialog } from "../components/RequestLeaveDialog";
import { RejectLeaveDialog } from "../components/RejectLeaveDialog";
import { LeaveRow } from "../components/LeaveRow";

const FILTERS: { value: "ALL" | LeaveStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  ...LEAVE_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
];

function EmployeeView() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useMyLeaves({ limit: 50 });

  return (
    <PageContainer>
      <PageHeader
        title="Leaves"
        description="File leave requests and track their status."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Request leave
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : data && data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <LeaveRow key={l.id} leave={l} variant="mine" />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No leave requests yet. Click "Request leave" to create one.
            </div>
          )}
        </CardContent>
      </Card>
      <RequestLeaveDialog open={open} onOpenChange={setOpen} />
    </PageContainer>
  );
}

function AdminView() {
  const [filter, setFilter] = useState<"ALL" | LeaveStatus>("PENDING");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const params = useMemo(() => (filter === "ALL" ? { limit: 100 } : { status: filter, limit: 100 }), [filter]);
  const { data, isLoading } = useAllLeaves(params);

  return (
    <PageContainer>
      <PageHeader
        title="Leaves"
        description="Review and decide on incoming leave requests."
        actions={
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Request leave
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : data && data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <LeaveRow
                    key={l.id}
                    leave={l}
                    variant="admin"
                    onRejectClick={(id) => setRejectId(id)}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No requests match this filter.
            </div>
          )}
        </CardContent>
      </Card>
      <RequestLeaveDialog open={open} onOpenChange={setOpen} />
      <RejectLeaveDialog
        open={rejectId !== null}
        onOpenChange={(v) => (!v ? setRejectId(null) : null)}
        leaveId={rejectId}
      />
    </PageContainer>
  );
}

export function LeavesPage() {
  const me = useAppSelector((s) => s.auth.user);
  return me?.role === "ADMIN" ? <AdminView /> : <EmployeeView />;
}
```

- [ ] **Step 2: Verify imports against the codebase**

Run:

```
grep -rn "PageHeader\|PageContainer" Frontend/src/components/common | head -5
grep -rn "s.auth.user" Frontend/src | head -3
```

The first should confirm `PageHeader` / `PageContainer` exist at those paths. The second should confirm the Redux slice key — if it's something different (e.g., `state.auth.profile`), update the selector accordingly.

- [ ] **Step 3: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/features/leaves/pages/LeavesPage.tsx
git commit -m "feat(leaves-fe): add LeavesPage (role-aware)"
```

---

## Task 15: Register the route + sidebar entry

**Files:**
- Modify: `Frontend/src/App.tsx`
- Modify: `Frontend/src/components/layout/SidebarNav.tsx`

- [ ] **Step 1: Add the import to `App.tsx`**

Add (alphabetical-ish, near the other feature page imports):

```tsx
import { LeavesPage } from "@/features/leaves/pages/LeavesPage";
```

- [ ] **Step 2: Register the route under `<ProtectedRoute>` / `<AppLayout>`**

Add the line near the other module routes (e.g., right after `/expenses`):

```tsx
          <Route path="/leaves" element={<LeavesPage />} />
```

- [ ] **Step 3: Add the sidebar item**

Open `Frontend/src/components/layout/SidebarNav.tsx`. Add `CalendarOff` to the `lucide-react` import block:

```tsx
  CalendarOff,
```

Then add this entry to the `NAV_ITEMS` array (place near `Attendance` so leave-related items sit together):

```tsx
  { to: "/leaves", label: "Leaves", Icon: CalendarOff },
```

- [ ] **Step 4: Typecheck**

```
pnpm --filter ./Frontend tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Smoke test in the browser**

Start dev servers if not running, log in, navigate to `/leaves`. Confirm:
- Sidebar shows "Leaves".
- As an EMPLOYEE: dialog opens, submit creates a row, Cancel removes it.
- As an ADMIN: list view loads, Approve / Reject buttons work and rows update.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/App.tsx Frontend/src/components/layout/SidebarNav.tsx
git commit -m "feat(leaves-fe): wire /leaves route + sidebar entry"
```

---

## Spec coverage check

| Spec section | Task(s) |
| --- | --- |
| Roles & permissions table | T5 (service guards), T7 (router), T8 (route tests) |
| LeaveRequest data model + indexes | T2 |
| New notification kinds | T1 |
| API endpoints + Zod bodies | T3, T6, T7 |
| `from`/`to` intersection filter | T5 (`listAllLeaves`), T6 (controller passthrough) |
| Overlap guard on create (409) | T5, T8 |
| Decision transition guard (409) | T5, T8 |
| Notifications fan-out (create + decide) | T5 |
| Frontend hooks + types | T9 |
| Status badge / dialogs / row | T10–T13 |
| Role-aware page | T14 |
| Sidebar + route wiring | T15 |
| Out-of-scope (balances, half-day, calendar, edit-after-submit) | Intentionally not built |
