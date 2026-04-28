# Employee Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Foundation User model with profile fields, add Department + Position collections, ship 16 HR-facing endpoints + an avatar/resume file upload pipeline, and build 5 frontend pages (Profile, People directory, Employee detail, Create employee, Departments).

**Architecture:** Two new backend modules (`employees`, `departments`) follow Foundation's `*.schema.ts / *.service.ts / *.controller.ts / *.routes.ts` quad pattern. A new `lib/storage.ts` defines a `FileStorage` interface with a `LocalStorage` impl (S3 swap deferred behind env). Multer buffers uploads in memory; service writes via `FileStorage`. Frontend gains `features/employees/` with thin orval-hook wrappers + 5 page components + 2 upload widgets + 1 `<RoleGate>` component. Sidebar reorders with HR-only `Departments` link gated client-side.

**Tech Stack:** Existing Foundation stack + `multer ^1.4.5-lts.1` (BE), `react-hook-form ^7.x` + `@hookform/resolvers ^3.x` (FE), 5 new shadcn primitives (`table`, `tabs`, `dialog`, `select`, `form`).

**Reference spec:** `docs/superpowers/specs/2026-04-28-employee-management-design.md` — read it first.
**Predecessor:** Foundation (`foundation-done` tag) must be complete. The branch `feat/foundation` is the base.

**Pre-task — branch:**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git checkout feat/foundation
git checkout -b feat/employee-management
```

All Phase B (Frontend) tasks assume the backend can be reached — bring it up at any time with `./dev.sh` (kills both ports on Ctrl-C).

---

# Phase A — Backend

## Task 1: Install multer + extend User model

**Files:**
- Modify: `Backend/package.json` (add `multer` + `@types/multer`)
- Modify: `Backend/src/models/user.model.ts`
- Test: `Backend/src/models/user.model.test.ts` (extend existing)

- [ ] **Step 1: Install multer**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend
pnpm add multer
pnpm add -D @types/multer
```

- [ ] **Step 2: Extend `Backend/src/models/user.model.ts`**

Replace the entire file with:

```ts
import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const ROLES = ["ADMIN", "HR", "EMPLOYEE", "PM"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const emergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relationship: { type: String, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "EMPLOYEE" },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, required: true, default: true },

    // Public profile
    jobTitle: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 25 },
    bio: { type: String, trim: true, maxlength: 500 },
    avatarUrl: { type: String },
    avatarKey: { type: String, select: false },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },

    // Sensitive (self + HR + Admin)
    hireDate: { type: Date },
    dateOfBirth: { type: Date },
    address: { type: String, trim: true, maxlength: 200 },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES },
    emergencyContact: { type: emergencyContactSchema, default: null },
    resumeUrl: { type: String },
    resumeKey: { type: String, select: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserModel = Model<UserDoc>;

export const User: UserModel = model<UserDoc>("User", userSchema);
```

The two `*Key` fields with `select: false` keep storage keys out of API responses by default (only `*Url` is exposed); the service can opt them in when it needs to delete the old file before saving a new one.

- [ ] **Step 3: Run existing user.model tests to confirm no regression**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/models/user.model.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 4: Append a new test for the extended fields**

Add to `Backend/src/models/user.model.test.ts` inside the existing `describe("User model", …)` block:

```ts
  it("accepts profile fields including emergencyContact subdoc", async () => {
    const { User } = await import("./user.model.js");
    const u = await User.create({
      email: "p@b.com",
      passwordHash: "x",
      name: "P",
      jobTitle: "Engineer",
      phone: "+91 555 0100",
      bio: "Builds things",
      hireDate: new Date("2024-01-15"),
      dateOfBirth: new Date("1990-05-10"),
      address: "1 Some St",
      employmentType: "FULL_TIME",
      emergencyContact: { name: "C", phone: "999", relationship: "spouse" },
    });
    expect(u.jobTitle).toBe("Engineer");
    expect(u.emergencyContact?.name).toBe("C");
    expect(u.isActive).toBe(true);
  });

  it("rejects invalid employmentType", async () => {
    const { User } = await import("./user.model.js");
    await expect(
      User.create({ email: "p2@b.com", passwordHash: "x", name: "P", employmentType: "FREELANCE" as never }),
    ).rejects.toThrow();
  });
```

- [ ] **Step 5: Run the user.model tests**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/models/user.model.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/package.json Backend/pnpm-lock.yaml Backend/src/models/user.model.ts Backend/src/models/user.model.test.ts
git commit -m "feat(backend): extend User model with profile fields + isActive + multer dep"
```

---

## Task 2: Department model

**Files:**
- Create: `Backend/src/models/department.model.ts`
- Create: `Backend/src/models/department.model.test.ts`

- [ ] **Step 1: Write failing tests at `Backend/src/models/department.model.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../test/setup.js";

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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe("Department model", () => {
  it("creates with name + code, lowercases code", async () => {
    const { Department } = await import("./department.model.js");
    const d = await Department.create({ name: "Engineering", code: "ENG" });
    expect(d.name).toBe("Engineering");
    expect(d.code).toBe("eng");
  });

  it("rejects duplicate name", async () => {
    const { Department } = await import("./department.model.js");
    await Department.create({ name: "HR", code: "hr" });
    await expect(Department.create({ name: "HR", code: "hr2" })).rejects.toThrow();
  });

  it("rejects duplicate code", async () => {
    const { Department } = await import("./department.model.js");
    await Department.create({ name: "Eng", code: "eng" });
    await expect(Department.create({ name: "Engineering 2", code: "ENG" })).rejects.toThrow();
  });

  it("rejects code with disallowed chars", async () => {
    const { Department } = await import("./department.model.js");
    await expect(Department.create({ name: "Bad", code: "Has Spaces" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/models/department.model.test.ts
```

- [ ] **Step 3: Create `Backend/src/models/department.model.ts`**

```ts
import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 30,
      match: [/^[a-z0-9-]+$/, "code must be lowercase alphanumeric or hyphens"],
    },
    description: { type: String, default: null, maxlength: 500 },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export type DepartmentDoc = InferSchemaType<typeof departmentSchema> & { _id: Types.ObjectId };
export type DepartmentModel = Model<DepartmentDoc>;

export const Department: DepartmentModel = model<DepartmentDoc>("Department", departmentSchema);
```

- [ ] **Step 4: Re-run — expect 4/4 PASS**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/models/department.model.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/models/department.model.ts Backend/src/models/department.model.test.ts
git commit -m "feat(backend): Department model with name/code uniqueness + slug regex"
```

---

## Task 3: Position model

**Files:**
- Create: `Backend/src/models/position.model.ts`
- Create: `Backend/src/models/position.model.test.ts`

- [ ] **Step 1: Failing tests at `Backend/src/models/position.model.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { startTestDb, stopTestDb, clearTestDb } from "../test/setup.js";

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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe("Position model", () => {
  it("creates open position (endedAt null)", async () => {
    const { Position } = await import("./position.model.js");
    const userId = new Types.ObjectId();
    const p = await Position.create({
      userId,
      title: "Engineer",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-01-01"),
    });
    expect(p.endedAt).toBe(null);
    expect(p.title).toBe("Engineer");
  });

  it("rejects invalid employmentType", async () => {
    const { Position } = await import("./position.model.js");
    await expect(
      Position.create({
        userId: new Types.ObjectId(),
        title: "X",
        employmentType: "FREELANCE" as never,
        startedAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, FAIL**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/models/position.model.test.ts
```

- [ ] **Step 3: Create `Backend/src/models/position.model.ts`**

```ts
import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";
import { EMPLOYMENT_TYPES } from "./user.model.js";

const positionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

positionSchema.index({ userId: 1, endedAt: 1 });

export type PositionDoc = InferSchemaType<typeof positionSchema> & { _id: Types.ObjectId };
export type PositionModel = Model<PositionDoc>;

export const Position: PositionModel = model<PositionDoc>("Position", positionSchema);
```

- [ ] **Step 4: Pass**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/models/position.model.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/models/position.model.ts Backend/src/models/position.model.test.ts
git commit -m "feat(backend): Position model for dated work-history entries"
```

---

## Task 4: FileStorage interface + LocalStorage

**Files:**
- Create: `Backend/src/lib/storage.ts`
- Create: `Backend/src/lib/storage.test.ts`
- Modify: `Backend/.gitignore` (add `uploads/`)

- [ ] **Step 1: Append `uploads/` to `Backend/.gitignore`**

```
uploads
```

- [ ] **Step 2: Failing tests at `Backend/src/lib/storage.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeAll(() => {
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
});

let tmpRoot = "";
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ems-storage-"));
  process.env.UPLOADS_DIR = tmpRoot;
  process.env.PUBLIC_BASE_URL = "http://test";
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("LocalStorage", () => {
  it("save writes a file under <scope>/<userId>-<uuid>.<ext> and returns key+url", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    const result = await s.save("avatar", "u1", {
      originalName: "me.png",
      mimeType: "image/png",
      buffer: Buffer.from("PNGDATA"),
    });
    expect(result.key).toMatch(/^avatar\/u1-[0-9a-f-]+\.png$/);
    expect(result.url).toBe(`http://test/files/${result.key}`);
    expect(existsSync(join(tmpRoot, result.key))).toBe(true);
    expect(readFileSync(join(tmpRoot, result.key)).toString()).toBe("PNGDATA");
  });

  it("save rejects unsupported mimeType", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    await expect(
      s.save("avatar", "u1", {
        originalName: "x.tiff",
        mimeType: "image/tiff",
        buffer: Buffer.from("X"),
      }),
    ).rejects.toThrow(/unsupported/i);
  });

  it("delete removes the file", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    const r = await s.save("resume", "u1", {
      originalName: "cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("PDF"),
    });
    expect(existsSync(join(tmpRoot, r.key))).toBe(true);
    await s.delete(r.key);
    expect(existsSync(join(tmpRoot, r.key))).toBe(false);
  });

  it("delete on missing key is a no-op", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    await expect(s.delete("avatar/nope.png")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run — FAIL**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/lib/storage.test.ts
```

- [ ] **Step 4: Create `Backend/src/lib/storage.ts`**

```ts
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { v4 as uuid } from "uuid";

export type StorageScope = "avatar" | "resume";

export interface SavedFile {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export interface FileInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface FileStorage {
  save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile>;
  delete(key: string): Promise<void>;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

const ALLOWED_BY_SCOPE: Record<StorageScope, string[]> = {
  avatar: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
  resume: ["application/pdf"],
};

class LocalStorage implements FileStorage {
  constructor(private rootDir: string, private publicBaseUrl: string) {}

  async save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile> {
    if (!ALLOWED_BY_SCOPE[scope].includes(file.mimeType)) {
      throw new Error(`unsupported mimeType ${file.mimeType} for scope ${scope}`);
    }
    const ext = MIME_EXTENSIONS[file.mimeType];
    if (!ext) throw new Error(`unsupported mimeType ${file.mimeType}`);
    const key = `${scope}/${userId}-${uuid()}.${ext}`;
    const fullPath = join(this.rootDir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer);
    return {
      key,
      url: `${this.publicBaseUrl}/files/${key}`,
      contentType: file.mimeType,
      size: file.buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.rootDir, key));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }
  }
}

export function createFileStorage(): FileStorage {
  const root = resolve(process.env.UPLOADS_DIR ?? "uploads");
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return new LocalStorage(root, base);
}
```

- [ ] **Step 5: Pass**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/lib/storage.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/.gitignore Backend/src/lib/storage.ts Backend/src/lib/storage.test.ts
git commit -m "feat(backend): FileStorage interface + LocalStorage impl"
```

---

## Task 5: Multer middleware

**Files:**
- Create: `Backend/src/middleware/upload.ts`

- [ ] **Step 1: Create `Backend/src/middleware/upload.ts`**

```ts
import multer from "multer";
import type { Request } from "express";
import { ValidationError } from "../lib/errors.js";

const AVATAR_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const RESUME_MIME = ["application/pdf"];

function fileFilter(allowed: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new ValidationError(`unsupported mime type: ${file.mimetype}`) as unknown as Error);
  };
}

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: fileFilter(AVATAR_MIME),
}).single("file");

export const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(RESUME_MIME),
}).single("file");
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: zero errors. (No tests yet — exercised via integration tests in Task 9.)

- [ ] **Step 3: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/middleware/upload.ts
git commit -m "feat(backend): multer middleware for avatar (2MB image) + resume (5MB pdf)"
```

---

## Task 6: Employees + Departments Zod schemas + OpenAPI registration

**Files:**
- Create: `Backend/src/modules/employees/employees.schema.ts`
- Create: `Backend/src/modules/departments/departments.schema.ts`

- [ ] **Step 1: Create `Backend/src/modules/employees/employees.schema.ts`**

```ts
import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { ROLES, EMPLOYMENT_TYPES } from "../../models/user.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const EmergencyContact = z
  .object({
    name: z.string().min(1).max(100),
    phone: z.string().min(1).max(25),
    relationship: z.string().min(1).max(50),
  })
  .openapi("EmergencyContact");

export const PublicProfile = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    jobTitle: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
  })
  .openapi("PublicProfile");

export const FullProfile = PublicProfile.extend({
  hireDate: z.string().datetime().nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  address: z.string().nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
  emergencyContact: EmergencyContact.nullable().optional(),
  resumeUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi("FullProfile");

export const ListEmployeesResponse = z
  .object({
    items: z.array(PublicProfile),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListEmployeesResponse");

export const CreateEmployeeBody = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    role: z.enum(ROLES).default("EMPLOYEE"),
    jobTitle: z.string().max(100).optional(),
    departmentId: objectIdString.optional(),
  })
  .openapi("CreateEmployeeBody");

export const UpdateEmployeeBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().max(25).optional(),
    bio: z.string().max(500).optional(),
    dateOfBirth: z.coerce.date().optional(),
    address: z.string().max(200).optional(),
    emergencyContact: EmergencyContact.optional(),
    // HR/Admin-only fields:
    role: z.enum(ROLES).optional(),
    departmentId: objectIdString.nullable().optional(),
    isActive: z.boolean().optional(),
    jobTitle: z.string().max(100).optional(),
    hireDate: z.coerce.date().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  })
  .openapi("UpdateEmployeeBody");

export const PositionResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    departmentId: z.string().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable().optional(),
  })
  .openapi("Position");

export const CreatePositionBody = z
  .object({
    title: z.string().min(1).max(100),
    departmentId: objectIdString.optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date().nullable().optional(),
  })
  .openapi("CreatePositionBody");

export const UpdatePositionBody = z
  .object({
    title: z.string().min(1).max(100).optional(),
    departmentId: objectIdString.nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().nullable().optional(),
  })
  .openapi("UpdatePositionBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });

const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("EmpErrorRef");

const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/employees",
  tags: ["employees"],
  security: sec,
  request: {
    query: z.object({
      q: z.string().optional(),
      department: objectIdString.optional(),
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListEmployeesResponse) },
    401: { description: "Unauthorized", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/employees/{id}",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(FullProfile) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees",
  tags: ["employees"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateEmployeeBody } } } },
  responses: {
    201: { description: "Created", ...json(FullProfile) },
    409: { description: "Email exists", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/employees/{id}",
  tags: ["employees"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdateEmployeeBody } } },
  },
  responses: {
    200: { description: "Updated", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/deactivate",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    204: { description: "Deactivated" },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

const fileUploadBody = {
  content: {
    "multipart/form-data": {
      schema: z.object({ file: z.string() }).openapi({ type: "object" }),
    },
  },
};

registry.registerPath({
  method: "post",
  path: "/employees/{id}/avatar",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }), body: fileUploadBody },
  responses: { 200: { description: "OK", ...json(z.object({ avatarUrl: z.string() })) } },
});

registry.registerPath({
  method: "delete",
  path: "/employees/{id}/avatar",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 204: { description: "Cleared" } },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/resume",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }), body: fileUploadBody },
  responses: { 200: { description: "OK", ...json(z.object({ resumeUrl: z.string() })) } },
});

registry.registerPath({
  method: "delete",
  path: "/employees/{id}/resume",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 204: { description: "Cleared" } },
});

registry.registerPath({
  method: "get",
  path: "/employees/{id}/positions",
  tags: ["positions"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 200: { description: "OK", ...json(z.array(PositionResponse)) } },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/positions",
  tags: ["positions"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: CreatePositionBody } } },
  },
  responses: { 201: { description: "Created", ...json(PositionResponse) } },
});

registry.registerPath({
  method: "patch",
  path: "/positions/{id}",
  tags: ["positions"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdatePositionBody } } },
  },
  responses: { 200: { description: "Updated", ...json(PositionResponse) } },
});
```

- [ ] **Step 2: Create `Backend/src/modules/departments/departments.schema.ts`**

```ts
import { z } from "zod";
import { registry } from "../../openapi/registry.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const DepartmentResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    description: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
    managerName: z.string().nullable().optional(),
    employeeCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Department");

export const ListDepartmentsResponse = z
  .object({
    items: z.array(DepartmentResponse),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListDepartmentsResponse");

export const CreateDepartmentBody = z
  .object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(30),
    description: z.string().max(500).optional(),
    managerId: objectIdString.optional(),
  })
  .openapi("CreateDepartmentBody");

export const UpdateDepartmentBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(30).optional(),
    description: z.string().max(500).nullable().optional(),
    managerId: objectIdString.nullable().optional(),
  })
  .openapi("UpdateDepartmentBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("DeptErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/departments",
  tags: ["departments"],
  security: sec,
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(ListDepartmentsResponse) } },
});

registry.registerPath({
  method: "post",
  path: "/departments",
  tags: ["departments"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateDepartmentBody } } } },
  responses: {
    201: { description: "Created", ...json(DepartmentResponse) },
    409: { description: "Conflict", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/departments/{id}",
  tags: ["departments"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdateDepartmentBody } } },
  },
  responses: { 200: { description: "Updated", ...json(DepartmentResponse) } },
});

registry.registerPath({
  method: "delete",
  path: "/departments/{id}",
  tags: ["departments"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    204: { description: "Deleted" },
    409: { description: "Has employees", ...json(ErrorRef) },
  },
});
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/modules/employees/employees.schema.ts Backend/src/modules/departments/departments.schema.ts
git commit -m "feat(backend): employees + departments Zod schemas with OpenAPI registration"
```

---

## Task 7: Employees service + projection helpers

**Files:**
- Create: `Backend/src/modules/employees/employees.service.ts`
- Create: `Backend/src/modules/employees/employees.service.test.ts`

- [ ] **Step 1: Failing tests at `Backend/src/modules/employees/employees.service.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function seedUser(role: "ADMIN" | "HR" | "EMPLOYEE" | "PM" = "EMPLOYEE", overrides: Record<string, unknown> = {}) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email: `u${Math.random()}@b.com`,
    passwordHash: await bcrypt.hash("pw", 4),
    name: "U",
    role,
    dateOfBirth: new Date("1990-01-01"),
    address: "secret",
    ...overrides,
  });
}

describe("employees.service projection helpers", () => {
  it("toPublicProfile strips sensitive fields", async () => {
    const u = await seedUser();
    const { toPublicProfile } = await import("./employees.service.js");
    const p = toPublicProfile(u, null);
    expect((p as Record<string, unknown>).dateOfBirth).toBeUndefined();
    expect((p as Record<string, unknown>).address).toBeUndefined();
    expect(p.email).toBe(u.email);
    expect(p.role).toBe("EMPLOYEE");
  });

  it("toFullProfile includes sensitive fields", async () => {
    const u = await seedUser();
    const { toFullProfile } = await import("./employees.service.js");
    const f = toFullProfile(u, null);
    expect(f.dateOfBirth).toBeDefined();
    expect(f.address).toBe("secret");
  });

  it("canSeeFullProfile: HR yes, ADMIN yes, EMPLOYEE only on self", async () => {
    const { canSeeFullProfile } = await import("./employees.service.js");
    const me = new Types.ObjectId().toString();
    const other = new Types.ObjectId().toString();
    expect(canSeeFullProfile({ id: me, role: "HR" }, other)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "ADMIN" }, other)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, other)).toBe(false);
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, me)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "PM" }, other)).toBe(false);
  });
});

describe("employees.service create", () => {
  it("createEmployee creates user with random password and returns full profile + temp password", async () => {
    const { createEmployee } = await import("./employees.service.js");
    const out = await createEmployee({ email: "n@b.com", name: "New", role: "EMPLOYEE" });
    expect(out.profile.email).toBe("n@b.com");
    expect(out.tempPassword).toMatch(/.{16,}/);
  });

  it("createEmployee on duplicate email throws ConflictError", async () => {
    const { createEmployee } = await import("./employees.service.js");
    await createEmployee({ email: "dupe@b.com", name: "A", role: "EMPLOYEE" });
    await expect(createEmployee({ email: "dupe@b.com", name: "B", role: "EMPLOYEE" })).rejects.toThrow();
  });
});

describe("employees.service positions", () => {
  it("addPosition with no prior open position just creates", async () => {
    const u = await seedUser();
    const { addPosition } = await import("./employees.service.js");
    const p = await addPosition(u._id.toString(), {
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-01-01"),
    });
    expect(p.endedAt).toBeNull();
  });

  it("addPosition auto-ends prior open position", async () => {
    const u = await seedUser();
    const { addPosition } = await import("./employees.service.js");
    const { Position } = await import("../../models/position.model.js");
    await addPosition(u._id.toString(), {
      title: "Old",
      employmentType: "FULL_TIME",
      startedAt: new Date("2023-01-01"),
    });
    await addPosition(u._id.toString(), {
      title: "New",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-06-01"),
    });
    const positions = await Position.find({ userId: u._id }).sort({ startedAt: 1 });
    expect(positions.length).toBe(2);
    expect(positions[0]!.endedAt).toBeInstanceOf(Date);
    expect(positions[1]!.endedAt).toBeNull();
  });
});

describe("employees.service deactivate", () => {
  it("deactivate sets isActive=false and ends open position", async () => {
    const u = await seedUser();
    const { addPosition, deactivate } = await import("./employees.service.js");
    const { Position } = await import("../../models/position.model.js");
    const { User } = await import("../../models/user.model.js");
    await addPosition(u._id.toString(), {
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2023-01-01"),
    });
    await deactivate(u._id.toString());
    const fresh = await User.findById(u._id);
    expect(fresh?.isActive).toBe(false);
    const open = await Position.find({ userId: u._id, endedAt: null });
    expect(open.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, FAIL**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/modules/employees/employees.service.test.ts
```

- [ ] **Step 3: Create `Backend/src/modules/employees/employees.service.ts`**

```ts
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Types } from "mongoose";
import { User, type UserDoc, type Role, type EmploymentType } from "../../models/user.model.js";
import { Department } from "../../models/department.model.js";
import { Position } from "../../models/position.model.js";
import { ConflictError, NotFoundError, ForbiddenError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

interface PublicShape {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}

interface FullShape extends PublicShape {
  hireDate?: Date | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  employmentType?: EmploymentType | null;
  emergencyContact?: { name?: string; phone?: string; relationship?: string } | null;
  resumeUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicProfile(u: UserDoc, departmentName: string | null): PublicShape {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    jobTitle: u.jobTitle ?? null,
    departmentId: u.departmentId ? u.departmentId.toString() : null,
    departmentName,
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
  };
}

export function toFullProfile(u: UserDoc, departmentName: string | null): FullShape {
  const d = u as unknown as { createdAt: Date; updatedAt: Date };
  return {
    ...toPublicProfile(u, departmentName),
    hireDate: u.hireDate ?? null,
    dateOfBirth: u.dateOfBirth ?? null,
    address: u.address ?? null,
    employmentType: u.employmentType ?? null,
    emergencyContact: u.emergencyContact ?? null,
    resumeUrl: u.resumeUrl ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function canSeeFullProfile(requester: { id: string; role: Role }, targetId: string): boolean {
  if (requester.role === "HR" || requester.role === "ADMIN") return true;
  return requester.id === targetId;
}

async function loadDepartmentName(departmentId: Types.ObjectId | null | undefined): Promise<string | null> {
  if (!departmentId) return null;
  const d = await Department.findById(departmentId).select("name").lean();
  return d?.name ?? null;
}

export interface ListInput {
  q?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export async function listEmployees(input: ListInput) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (input.q) filter.$or = [
    { name: { $regex: input.q, $options: "i" } },
    { email: { $regex: input.q, $options: "i" } },
  ];
  if (input.departmentId) filter.departmentId = new Types.ObjectId(input.departmentId);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  const deptIds = Array.from(new Set(users.map((u) => u.departmentId?.toString()).filter(Boolean) as string[]));
  const depts = await Department.find({ _id: { $in: deptIds } }).select("name").lean();
  const nameById = new Map<string, string>();
  for (const d of depts) nameById.set(d._id.toString(), d.name);
  const items = users.map((u) =>
    toPublicProfile(u, u.departmentId ? nameById.get(u.departmentId.toString()) ?? null : null),
  );
  return { items, total, page, limit };
}

export async function getEmployee(id: string, requester: { id: string; role: Role }): Promise<PublicShape | FullShape> {
  const u = await User.findById(id);
  if (!u) throw new NotFoundError("Employee");
  const deptName = await loadDepartmentName(u.departmentId);
  return canSeeFullProfile(requester, id) ? toFullProfile(u, deptName) : toPublicProfile(u, deptName);
}

export interface CreateInput {
  email: string;
  name: string;
  role: Role;
  jobTitle?: string;
  departmentId?: string;
}

export async function createEmployee(input: CreateInput): Promise<{ profile: FullShape; tempPassword: string }> {
  const tempPassword = crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  try {
    const created = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
      jobTitle: input.jobTitle,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
      isActive: true,
    });
    logger.info({ email: created.email }, `created employee ${created.email} with temp password ${tempPassword}`);
    const deptName = await loadDepartmentName(created.departmentId);
    return { profile: toFullProfile(created, deptName), tempPassword };
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Email already exists");
    }
    throw err;
  }
}

const SELF_EDITABLE = new Set(["name", "phone", "bio", "dateOfBirth", "address", "emergencyContact"]);

export async function updateEmployee(
  id: string,
  patch: Record<string, unknown>,
  requester: { id: string; role: Role },
): Promise<FullShape> {
  const isElevated = requester.role === "HR" || requester.role === "ADMIN";
  const isSelf = requester.id === id;
  if (!isElevated && !isSelf) throw new ForbiddenError();

  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isElevated) {
      filtered[k] = v;
    } else if (SELF_EDITABLE.has(k)) {
      filtered[k] = v;
    } else {
      throw new ForbiddenError(`Field '${k}' is not editable by you`);
    }
  }

  const u = await User.findByIdAndUpdate(id, filtered, { new: true, runValidators: true });
  if (!u) throw new NotFoundError("Employee");
  const deptName = await loadDepartmentName(u.departmentId);
  return toFullProfile(u, deptName);
}

export interface AddPositionInput {
  title: string;
  departmentId?: string;
  employmentType: EmploymentType;
  startedAt: Date;
  endedAt?: Date | null;
}

export async function addPosition(userId: string, input: AddPositionInput) {
  // Auto-end any prior open position
  await Position.updateMany(
    { userId: new Types.ObjectId(userId), endedAt: null },
    { $set: { endedAt: input.startedAt } },
  );
  const pos = await Position.create({
    userId: new Types.ObjectId(userId),
    title: input.title,
    departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : null,
    employmentType: input.employmentType,
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
  });
  return pos;
}

export async function deactivate(id: string): Promise<void> {
  const u = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!u) throw new NotFoundError("Employee");
  await Position.updateMany(
    { userId: new Types.ObjectId(id), endedAt: null },
    { $set: { endedAt: new Date() } },
  );
}

export async function listPositions(userId: string) {
  const positions = await Position.find({ userId: new Types.ObjectId(userId) }).sort({ startedAt: -1 });
  const deptIds = Array.from(new Set(positions.map((p) => p.departmentId?.toString()).filter(Boolean) as string[]));
  const depts = await Department.find({ _id: { $in: deptIds } }).select("name").lean();
  const nameById = new Map<string, string>();
  for (const d of depts) nameById.set(d._id.toString(), d.name);
  return positions.map((p) => ({
    id: p._id.toString(),
    userId: p.userId.toString(),
    title: p.title,
    departmentId: p.departmentId ? p.departmentId.toString() : null,
    departmentName: p.departmentId ? nameById.get(p.departmentId.toString()) ?? null : null,
    employmentType: p.employmentType,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
  }));
}

export async function updatePosition(positionId: string, patch: Partial<AddPositionInput>) {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.departmentId !== undefined) update.departmentId = patch.departmentId ? new Types.ObjectId(patch.departmentId) : null;
  if (patch.employmentType !== undefined) update.employmentType = patch.employmentType;
  if (patch.startedAt !== undefined) update.startedAt = patch.startedAt;
  if (patch.endedAt !== undefined) update.endedAt = patch.endedAt;
  const p = await Position.findByIdAndUpdate(positionId, update, { new: true });
  if (!p) throw new NotFoundError("Position");
  return p;
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/modules/employees/employees.service.test.ts
```

Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/modules/employees/employees.service.ts Backend/src/modules/employees/employees.service.test.ts
git commit -m "feat(backend): employees service with projection helpers + position auto-end + deactivate"
```

---

## Task 8: Departments service

**Files:**
- Create: `Backend/src/modules/departments/departments.service.ts`
- Create: `Backend/src/modules/departments/departments.service.test.ts`

- [ ] **Step 1: Failing tests at `Backend/src/modules/departments/departments.service.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe("departments.service", () => {
  it("create returns dept with employeeCount=0", async () => {
    const { createDepartment } = await import("./departments.service.js");
    const d = await createDepartment({ name: "Eng", code: "eng" });
    expect(d.code).toBe("eng");
    expect(d.employeeCount).toBe(0);
  });

  it("create rejects duplicate name", async () => {
    const { createDepartment } = await import("./departments.service.js");
    await createDepartment({ name: "HR", code: "hr" });
    await expect(createDepartment({ name: "HR", code: "hr2" })).rejects.toThrow();
  });

  it("listDepartments returns paginated items with employeeCount", async () => {
    const { User } = await import("../../models/user.model.js");
    const { createDepartment, listDepartments } = await import("./departments.service.js");
    const d1 = await createDepartment({ name: "Eng", code: "eng" });
    await User.create({
      email: "x@b.com",
      passwordHash: await bcrypt.hash("pw", 4),
      name: "X",
      role: "EMPLOYEE",
      departmentId: new Types.ObjectId(d1.id),
    });
    const list = await listDepartments({ page: 1, limit: 20 });
    expect(list.items.length).toBe(1);
    expect(list.items[0]!.employeeCount).toBe(1);
  });

  it("deleteDepartment refuses when employees still reference it", async () => {
    const { User } = await import("../../models/user.model.js");
    const { createDepartment, deleteDepartment } = await import("./departments.service.js");
    const d = await createDepartment({ name: "Eng", code: "eng" });
    await User.create({
      email: "y@b.com",
      passwordHash: await bcrypt.hash("pw", 4),
      name: "Y",
      role: "EMPLOYEE",
      departmentId: new Types.ObjectId(d.id),
    });
    await expect(deleteDepartment(d.id)).rejects.toThrow();
  });

  it("deleteDepartment succeeds when no employees reference it", async () => {
    const { Department } = await import("../../models/department.model.js");
    const { createDepartment, deleteDepartment } = await import("./departments.service.js");
    const d = await createDepartment({ name: "Eng", code: "eng" });
    await deleteDepartment(d.id);
    const found = await Department.findById(d.id);
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Run, FAIL**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/modules/departments/departments.service.test.ts
```

- [ ] **Step 3: Create `Backend/src/modules/departments/departments.service.ts`**

```ts
import { Types } from "mongoose";
import { Department, type DepartmentDoc } from "../../models/department.model.js";
import { User } from "../../models/user.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

interface DepartmentResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  employeeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

async function buildResponse(d: DepartmentDoc, employeeCount: number): Promise<DepartmentResponse> {
  let managerName: string | null = null;
  if (d.managerId) {
    const m = await User.findById(d.managerId).select("name").lean();
    managerName = m?.name ?? null;
  }
  const t = d as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: d._id.toString(),
    name: d.name,
    code: d.code,
    description: d.description ?? null,
    managerId: d.managerId ? d.managerId.toString() : null,
    managerName,
    employeeCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export interface CreateDeptInput {
  name: string;
  code: string;
  description?: string;
  managerId?: string;
}

export async function createDepartment(input: CreateDeptInput): Promise<DepartmentResponse> {
  try {
    const created = await Department.create({
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
    });
    return buildResponse(created, 0);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Department with this name or code already exists");
    }
    throw err;
  }
}

export async function listDepartments(input: { page?: number; limit?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const [docs, total] = await Promise.all([
    Department.find().sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    Department.countDocuments(),
  ]);
  const counts = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { departmentId: { $in: docs.map((d) => d._id) } } },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);
  const countById = new Map<string, number>();
  for (const c of counts) countById.set(c._id.toString(), c.count);
  const items = await Promise.all(docs.map((d) => buildResponse(d, countById.get(d._id.toString()) ?? 0)));
  return { items, total, page, limit };
}

export interface UpdateDeptInput {
  name?: string;
  code?: string;
  description?: string | null;
  managerId?: string | null;
}

export async function updateDepartment(id: string, patch: UpdateDeptInput): Promise<DepartmentResponse> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.code !== undefined) update.code = patch.code;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.managerId !== undefined) update.managerId = patch.managerId ? new Types.ObjectId(patch.managerId) : null;
  try {
    const d = await Department.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!d) throw new NotFoundError("Department");
    const employeeCount = await User.countDocuments({ departmentId: d._id });
    return buildResponse(d, employeeCount);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Department with this name or code already exists");
    }
    throw err;
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  const count = await User.countDocuments({ departmentId: new Types.ObjectId(id) });
  if (count > 0) {
    throw new ConflictError(`Cannot delete department: ${count} employees still reference it`);
  }
  const result = await Department.findByIdAndDelete(id);
  if (!result) throw new NotFoundError("Department");
}
```

- [ ] **Step 4: Pass**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/modules/departments/departments.service.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/modules/departments/departments.service.ts Backend/src/modules/departments/departments.service.test.ts
git commit -m "feat(backend): departments service with employee count + cannot-delete-with-employees guard"
```

---

## Task 9: Employees + Departments controllers + routes + app wiring + integration tests

**Files:**
- Create: `Backend/src/modules/employees/employees.controller.ts`
- Create: `Backend/src/modules/employees/employees.routes.ts`
- Create: `Backend/src/modules/departments/departments.controller.ts`
- Create: `Backend/src/modules/departments/departments.routes.ts`
- Modify: `Backend/src/app.ts`
- Create: `Backend/src/modules/employees/employees.routes.test.ts`

- [ ] **Step 1: Create `Backend/src/modules/employees/employees.controller.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import * as svc from "./employees.service.js";
import { createFileStorage } from "../../lib/storage.js";
import { User } from "../../models/user.model.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";

const storage = createFileStorage();

function requireUser(req: Request) {
  if (!req.user) throw new ForbiddenError();
  return req.user;
}

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listEmployees({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      departmentId: typeof req.query.department === "string" ? req.query.department : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const profile = await svc.getEmployee(req.params.id!, me);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as svc.CreateInput;
    const out = await svc.createEmployee(body);
    res.status(201).json(out.profile);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const profile = await svc.updateEmployee(req.params.id!, req.validated as Record<string, unknown>, me);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function postDeactivate(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deactivate(req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function ensureSelfOrElevated(req: Request) {
  const me = requireUser(req);
  if (me.role === "HR" || me.role === "ADMIN") return;
  if (me.id !== req.params.id) throw new ForbiddenError();
}

export async function postAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const file = req.file;
    if (!file) throw new ValidationError("Missing file");
    const userId = req.params.id!;
    const u = await User.findById(userId).select("+avatarKey");
    if (!u) throw new NotFoundError("Employee");
    const saved = await storage.save("avatar", userId, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    if (u.avatarKey) await storage.delete(u.avatarKey);
    u.avatarKey = saved.key;
    u.avatarUrl = saved.url;
    await u.save();
    res.json({ avatarUrl: saved.url });
  } catch (err) {
    next(err);
  }
}

export async function deleteAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const u = await User.findById(req.params.id).select("+avatarKey");
    if (!u) throw new NotFoundError("Employee");
    if (u.avatarKey) await storage.delete(u.avatarKey);
    u.avatarKey = undefined;
    u.avatarUrl = undefined;
    await u.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postResume(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const file = req.file;
    if (!file) throw new ValidationError("Missing file");
    const userId = req.params.id!;
    const u = await User.findById(userId).select("+resumeKey");
    if (!u) throw new NotFoundError("Employee");
    const saved = await storage.save("resume", userId, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    if (u.resumeKey) await storage.delete(u.resumeKey);
    u.resumeKey = saved.key;
    u.resumeUrl = saved.url;
    await u.save();
    res.json({ resumeUrl: saved.url });
  } catch (err) {
    next(err);
  }
}

export async function deleteResume(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const u = await User.findById(req.params.id).select("+resumeKey");
    if (!u) throw new NotFoundError("Employee");
    if (u.resumeKey) await storage.delete(u.resumeKey);
    u.resumeKey = undefined;
    u.resumeUrl = undefined;
    await u.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    if (!svc.canSeeFullProfile(me, req.params.id!)) throw new ForbiddenError();
    const positions = await svc.listPositions(req.params.id!);
    res.json(positions);
  } catch (err) {
    next(err);
  }
}

export async function postPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as svc.AddPositionInput;
    const p = await svc.addPosition(req.params.id!, body);
    res.status(201).json({
      id: p._id.toString(),
      userId: p.userId.toString(),
      title: p.title,
      departmentId: p.departmentId ? p.departmentId.toString() : null,
      departmentName: null,
      employmentType: p.employmentType,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function patchPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const p = await svc.updatePosition(req.params.id!, req.validated as Partial<svc.AddPositionInput>);
    res.json({
      id: p._id.toString(),
      userId: p.userId.toString(),
      title: p.title,
      departmentId: p.departmentId ? p.departmentId.toString() : null,
      departmentName: null,
      employmentType: p.employmentType,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
    });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 2: Create `Backend/src/modules/employees/employees.routes.ts`**

```ts
import { Router } from "express";
import * as ctl from "./employees.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadAvatar, uploadResume } from "../../middleware/upload.js";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  CreatePositionBody,
  UpdatePositionBody,
} from "./employees.schema.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get("/", ctl.getList);
employeesRouter.post("/", requireRole("HR", "ADMIN"), validate(CreateEmployeeBody), ctl.postCreate);
employeesRouter.get("/:id", ctl.getOne);
employeesRouter.patch("/:id", validate(UpdateEmployeeBody), ctl.patchOne);
employeesRouter.post("/:id/deactivate", requireRole("HR", "ADMIN"), ctl.postDeactivate);

employeesRouter.post("/:id/avatar", uploadAvatar, ctl.postAvatar);
employeesRouter.delete("/:id/avatar", ctl.deleteAvatar);
employeesRouter.post("/:id/resume", uploadResume, ctl.postResume);
employeesRouter.delete("/:id/resume", ctl.deleteResume);

employeesRouter.get("/:id/positions", ctl.getPositions);
employeesRouter.post(
  "/:id/positions",
  requireRole("HR", "ADMIN"),
  validate(CreatePositionBody),
  ctl.postPosition,
);

export const positionsRouter = Router();
positionsRouter.use(requireAuth);
positionsRouter.patch(
  "/:id",
  requireRole("HR", "ADMIN"),
  validate(UpdatePositionBody),
  ctl.patchPosition,
);
```

- [ ] **Step 3: Create `Backend/src/modules/departments/departments.controller.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import * as svc from "./departments.service.js";

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listDepartments({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const dept = await svc.createDepartment(req.validated as svc.CreateDeptInput);
    res.status(201).json(dept);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const dept = await svc.updateDepartment(req.params.id!, req.validated as svc.UpdateDeptInput);
    res.json(dept);
  } catch (err) {
    next(err);
  }
}

export async function deleteOne(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteDepartment(req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 4: Create `Backend/src/modules/departments/departments.routes.ts`**

```ts
import { Router } from "express";
import * as ctl from "./departments.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { CreateDepartmentBody, UpdateDepartmentBody } from "./departments.schema.js";

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get("/", ctl.getList);
departmentsRouter.post("/", requireRole("HR", "ADMIN"), validate(CreateDepartmentBody), ctl.postCreate);
departmentsRouter.patch("/:id", requireRole("HR", "ADMIN"), validate(UpdateDepartmentBody), ctl.patchOne);
departmentsRouter.delete("/:id", requireRole("ADMIN"), ctl.deleteOne);
```

- [ ] **Step 5: Modify `Backend/src/app.ts` — add static + new routers + schema imports**

Replace the existing `app.ts` with:

```ts
import express from "express";
import path from "node:path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { employeesRouter, positionsRouter } from "./modules/employees/employees.routes.js";
import { departmentsRouter } from "./modules/departments/departments.routes.js";
import "./modules/auth/auth.schema.js";
import "./modules/employees/employees.schema.js";
import "./modules/departments/departments.schema.js";
import { buildOpenApiDocument } from "./openapi/spec.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(globalLimiter);

  // Static file serving for uploaded avatars/resumes
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? "uploads");
  app.use("/files", express.static(uploadsDir, { fallthrough: false }));

  const openapi = buildOpenApiDocument();
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/employees", employeesRouter);
  app.use("/positions", positionsRouter);
  app.use("/departments", departmentsRouter);

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 6: Failing integration tests at `Backend/src/modules/employees/employees.routes.test.ts`**

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
    UPLOADS_DIR: "/tmp/ems-test-uploads",
    PUBLIC_BASE_URL: "http://test",
  });
  await startTestDb();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

async function seed(role: "ADMIN" | "HR" | "EMPLOYEE" | "PM", email: string) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
    dateOfBirth: new Date("1990-01-01"),
    address: "secret",
  });
}

async function tokenFor(userId: string, role: "ADMIN" | "HR" | "EMPLOYEE" | "PM") {
  const { signAccessToken } = await import("../../lib/tokens.js");
  return signAccessToken({ sub: userId, role });
}

describe("/employees", () => {
  it("GET /employees lists employees (any auth)", async () => {
    const e = await seed("EMPLOYEE", "e1@b.com");
    const tk = await tokenFor(e._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app).get("/employees").set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  it("GET /employees/:id returns PublicProfile for non-self non-HR", async () => {
    const me = await seed("EMPLOYEE", "me@b.com");
    const other = await seed("EMPLOYEE", "other@b.com");
    const tk = await tokenFor(me._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app).get(`/employees/${other._id}`).set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.dateOfBirth).toBeUndefined();
    expect(res.body.address).toBeUndefined();
  });

  it("GET /employees/:id returns FullProfile for self", async () => {
    const me = await seed("EMPLOYEE", "self@b.com");
    const tk = await tokenFor(me._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app).get(`/employees/${me._id}`).set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.address).toBe("secret");
  });

  it("GET /employees/:id returns FullProfile for HR", async () => {
    const hr = await seed("HR", "hr@b.com");
    const e = await seed("EMPLOYEE", "e@b.com");
    const tk = await tokenFor(hr._id.toString(), "HR");
    const app = await buildApp();
    const res = await request(app).get(`/employees/${e._id}`).set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(200);
    expect(res.body.address).toBe("secret");
  });

  it("POST /employees rejects non-HR with 403", async () => {
    const e = await seed("EMPLOYEE", "e@b.com");
    const tk = await tokenFor(e._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app)
      .post("/employees")
      .set("Authorization", `Bearer ${tk}`)
      .send({ email: "n@b.com", name: "N", role: "EMPLOYEE" });
    expect(res.status).toBe(403);
  });

  it("POST /employees by HR creates user", async () => {
    const hr = await seed("HR", "hr@b.com");
    const tk = await tokenFor(hr._id.toString(), "HR");
    const app = await buildApp();
    const res = await request(app)
      .post("/employees")
      .set("Authorization", `Bearer ${tk}`)
      .send({ email: "n@b.com", name: "N", role: "EMPLOYEE" });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("n@b.com");
  });

  it("PATCH /employees/:id by self updates allowed fields", async () => {
    const me = await seed("EMPLOYEE", "me@b.com");
    const tk = await tokenFor(me._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app)
      .patch(`/employees/${me._id}`)
      .set("Authorization", `Bearer ${tk}`)
      .send({ bio: "Hello world" });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Hello world");
  });

  it("PATCH /employees/:id by self with role change is forbidden", async () => {
    const me = await seed("EMPLOYEE", "me@b.com");
    const tk = await tokenFor(me._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app)
      .patch(`/employees/${me._id}`)
      .set("Authorization", `Bearer ${tk}`)
      .send({ role: "ADMIN" });
    expect(res.status).toBe(403);
  });

  it("POST /employees/:id/avatar accepts PNG", async () => {
    const me = await seed("EMPLOYEE", "me@b.com");
    const tk = await tokenFor(me._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app)
      .post(`/employees/${me._id}/avatar`)
      .set("Authorization", `Bearer ${tk}`)
      .attach("file", Buffer.from("PNG"), { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(/^http:\/\/test\/files\/avatar\//);
  });

  it("POST /employees/:id/resume rejects non-PDF with 400", async () => {
    const me = await seed("EMPLOYEE", "me@b.com");
    const tk = await tokenFor(me._id.toString(), "EMPLOYEE");
    const app = await buildApp();
    const res = await request(app)
      .post(`/employees/${me._id}/resume`)
      .set("Authorization", `Bearer ${tk}`)
      .attach("file", Buffer.from("PNGDATA"), { filename: "x.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("POST /employees/:id/deactivate by HR sets isActive false and ends position", async () => {
    const hr = await seed("HR", "hr@b.com");
    const e = await seed("EMPLOYEE", "e@b.com");
    const { Position } = await import("../../models/position.model.js");
    const { Types } = await import("mongoose");
    await Position.create({
      userId: new Types.ObjectId(e._id.toString()),
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-01-01"),
    });
    const tk = await tokenFor(hr._id.toString(), "HR");
    const app = await buildApp();
    const res = await request(app)
      .post(`/employees/${e._id}/deactivate`)
      .set("Authorization", `Bearer ${tk}`);
    expect(res.status).toBe(204);
    const open = await Position.find({ userId: e._id, endedAt: null });
    expect(open.length).toBe(0);
  });
});
```

- [ ] **Step 7: Run, FAIL initially (because controllers/routes still need wiring)** — but after Steps 1–5 they're done so should PASS

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/modules/employees/employees.routes.test.ts
```

Expected: 11/11 PASS.

- [ ] **Step 8: Run full suite**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test
```

Expected: previous 49 + new tests from Tasks 1, 2, 3, 4, 7, 8, 9 = roughly **49 + 2 + 4 + 2 + 4 + 7 + 5 + 11 = 84** passing.

- [ ] **Step 9: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/modules/ Backend/src/app.ts
git commit -m "feat(backend): wire employees + departments + positions routes + 11 integration tests"
```

---

## Task 10: Departments routes integration test

**Files:**
- Create: `Backend/src/modules/departments/departments.routes.test.ts`

- [ ] **Step 1: Write tests at `Backend/src/modules/departments/departments.routes.test.ts`**

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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

async function seedAndToken(role: "ADMIN" | "HR" | "EMPLOYEE", email: string) {
  const { User } = await import("../../models/user.model.js");
  const u = await User.create({
    email, passwordHash: await bcrypt.hash("pw", 4), name: email, role,
  });
  const { signAccessToken } = await import("../../lib/tokens.js");
  return { id: u._id.toString(), token: signAccessToken({ sub: u._id.toString(), role }) };
}

describe("/departments", () => {
  it("GET /departments by EMPLOYEE returns 200", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app).get("/departments").set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(200);
  });

  it("POST /departments by EMPLOYEE 403", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/departments")
      .set("Authorization", `Bearer ${e.token}`)
      .send({ name: "Eng", code: "eng" });
    expect(res.status).toBe(403);
  });

  it("POST /departments by HR creates", async () => {
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/departments")
      .set("Authorization", `Bearer ${hr.token}`)
      .send({ name: "Eng", code: "eng" });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe("eng");
  });

  it("DELETE /departments/:id by HR is forbidden (Admin-only)", async () => {
    const hr = await seedAndToken("HR", "hr@b.com");
    const admin = await seedAndToken("ADMIN", "ad@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/departments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Eng", code: "eng" });
    const res = await request(app)
      .delete(`/departments/${created.body.id}`)
      .set("Authorization", `Bearer ${hr.token}`);
    expect(res.status).toBe(403);
  });

  it("DELETE /departments/:id with employees returns 409", async () => {
    const admin = await seedAndToken("ADMIN", "ad@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/departments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Eng", code: "eng" });
    // Assign an employee to the dept
    const { User } = await import("../../models/user.model.js");
    const { Types } = await import("mongoose");
    await User.create({
      email: "x@b.com",
      passwordHash: await bcrypt.hash("pw", 4),
      name: "X",
      role: "EMPLOYEE",
      departmentId: new Types.ObjectId(created.body.id),
    });
    const res = await request(app)
      .delete(`/departments/${created.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test src/modules/departments/departments.routes.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Backend/src/modules/departments/departments.routes.test.ts
git commit -m "test(backend): integration tests for /departments role gates + delete-with-employees guard"
```

---

## Task 11: Backend final sweep + tag

- [ ] **Step 1: Run full backend suite**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm test
```

Expected: ~89 tests passing (49 from Foundation + ~40 from this sub-project).

- [ ] **Step 2: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Build**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm build
```

Expected: clean dist.

- [ ] **Step 4: Live smoke against the dev server (Mongo must be running)**

```bash
# Terminal 1
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project && pnpm seed && pnpm --dir Backend dev &
BE_PID=$!
sleep 4

# Login as admin → get access token
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@sms-ip.local","password":"ChangeMe-Admin-1!"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')

# Create a department
curl -s -X POST http://localhost:3000/departments \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Engineering","code":"eng"}' | head -c 300; echo

# List employees
curl -s http://localhost:3000/employees -H "Authorization: Bearer $TOKEN" | head -c 200; echo

# Verify swagger has the new tags
curl -s http://localhost:3000/openapi.json | python3 -c 'import json,sys;d=json.load(sys.stdin);print(sorted(set(t for p in d["paths"].values() for op in p.values() for t in op.get("tags",[]))))'

kill $BE_PID
```

Expected output: department creation returns 201 JSON, employees list returns the seeded admin, OpenAPI tags include `auth`, `departments`, `employees`, `health`, `positions`.

- [ ] **Step 5: Tag**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git tag em-backend-done
git tag --list 'em-*'
```

---

# Phase B — Frontend

## Task 12: Regenerate orval client + add new shadcn primitives

**Files:**
- Modify: `Frontend/src/api/generated/` (regenerated)
- Create: `Frontend/src/components/ui/table.tsx`
- Create: `Frontend/src/components/ui/dialog.tsx`
- Create: `Frontend/src/components/ui/tabs.tsx`
- Create: `Frontend/src/components/ui/select.tsx`
- Create: `Frontend/src/components/ui/form.tsx`
- Modify: `Frontend/package.json` (add `react-hook-form` + `@hookform/resolvers` + new Radix deps + sonner already there)

- [ ] **Step 1: Install new FE deps**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend
pnpm add react-hook-form @hookform/resolvers @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select
```

- [ ] **Step 2: Add shadcn primitives**

For each new primitive, fetch the official `new-york` source from the shadcn docs and place into `Frontend/src/components/ui/<name>.tsx`. The five files are: `table.tsx`, `dialog.tsx`, `tabs.tsx`, `select.tsx`, `form.tsx`. Use the v0.x shadcn CLI templates verbatim — they are well-known and the implementer agent should look them up. Each is between 80–250 lines. They are not reproduced inline here because they are public standard files; the agent should fetch them from `https://ui.shadcn.com/docs/components/<name>` and copy directly. Confirm with `pnpm exec tsc -b` after adding.

- [ ] **Step 3: Bring up backend and regenerate client**

```bash
# In one terminal
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Backend && pnpm dev
# In another terminal
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm gen:api
ls Frontend/src/api/generated
```

Expected: `auth/`, `departments/`, `employees/`, `health/`, `positions/`, `model/` directories produced.

- [ ] **Step 4: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 5: Commit (only the deps + ui/ shadcn files; generated/ is gitignored)**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/package.json Frontend/pnpm-lock.yaml Frontend/src/components/ui/
git commit -m "feat(frontend): add react-hook-form + 5 shadcn primitives (table/dialog/tabs/select/form)"
```

---

## Task 13: RoleGate component + test

**Files:**
- Create: `Frontend/src/features/auth/RoleGate.tsx`
- Create: `Frontend/src/features/auth/RoleGate.test.tsx`

- [ ] **Step 1: Write failing test at `Frontend/src/features/auth/RoleGate.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice, sessionEstablished } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { RoleGate } from "./RoleGate";

function buildStore() {
  return configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
}

const sampleUser = (role: "ADMIN" | "HR" | "EMPLOYEE" | "PM") => ({
  id: "u1",
  email: "a@b.com",
  name: "A",
  role,
  isVerified: true,
});

describe("RoleGate", () => {
  it("renders children when user role is allowed", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("HR") }));
    render(
      <Provider store={store}>
        <RoleGate roles={["HR", "ADMIN"]}><span>visible</span></RoleGate>
      </Provider>,
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("renders nothing when user role is not allowed", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("EMPLOYEE") }));
    render(
      <Provider store={store}>
        <RoleGate roles={["HR", "ADMIN"]}><span>secret</span></RoleGate>
      </Provider>,
    );
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders fallback when provided and role not allowed", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("EMPLOYEE") }));
    render(
      <Provider store={store}>
        <RoleGate roles={["HR"]} fallback={<span>nope</span>}><span>secret</span></RoleGate>
      </Provider>,
    );
    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Create `Frontend/src/features/auth/RoleGate.tsx`**

```tsx
import type { ReactNode } from "react";
import { useAppSelector } from "@/app/hooks";
import type { Role } from "./authSlice";

interface Props {
  roles: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ roles, fallback = null, children }: Props) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <>{fallback}</>;
  if (!roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 3: Run, expect 3/3 PASS**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm test src/features/auth/RoleGate.test.tsx
```

- [ ] **Step 4: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/features/auth/RoleGate.tsx Frontend/src/features/auth/RoleGate.test.tsx
git commit -m "feat(frontend): RoleGate component with optional fallback"
```

---

## Task 14: Avatar + Resume upload widgets

**Files:**
- Create: `Frontend/src/features/employees/api/hooks.ts`
- Create: `Frontend/src/features/employees/components/AvatarUpload.tsx`
- Create: `Frontend/src/features/employees/components/ResumeUpload.tsx`

- [ ] **Step 1: Create `Frontend/src/features/employees/api/hooks.ts`**

```ts
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getApi } from "@/api/axios";

const api = () => getApi();

export const employeeKeys = {
  all: ["employees"] as const,
  list: (params: Record<string, unknown>) => ["employees", "list", params] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
  positions: (id: string) => ["employees", "positions", id] as const,
};

export const departmentKeys = {
  all: ["departments"] as const,
  list: (params: Record<string, unknown>) => ["departments", "list", params] as const,
};

export interface PublicProfile {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "HR" | "EMPLOYEE" | "PM";
  isActive: boolean;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface FullProfile extends PublicProfile {
  hireDate?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | null;
  emergencyContact?: { name: string; phone: string; relationship: string } | null;
  resumeUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useEmployeesList(params: { q?: string; department?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => {
      const res = await api().get("/employees", { params });
      return res.data as { items: PublicProfile[]; total: number; page: number; limit: number };
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await api().get(`/employees/${id}`);
      return res.data as FullProfile;
    },
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<FullProfile>) => {
      const res = await api().patch(`/employees/${id}`, patch);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useUploadAvatar(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api().post(`/employees/${id}/avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as { avatarUrl: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.detail(id) }),
  });
}

export function useUploadResume(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api().post(`/employees/${id}/resume`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as { resumeUrl: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.detail(id) }),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name: string; role: string; jobTitle?: string; departmentId?: string }) => {
      const res = await api().post("/employees", input);
      return res.data as FullProfile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export function useDeactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api().post(`/employees/${id}/deactivate`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useDepartmentsList(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: departmentKeys.list(params),
    queryFn: async () => {
      const res = await api().get("/departments", { params });
      return res.data as { items: Department[]; total: number; page: number; limit: number };
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; code: string; description?: string }) => {
      const res = await api().post("/departments", input);
      return res.data as Department;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.all }),
  });
}
```

- [ ] **Step 2: Create `Frontend/src/features/employees/components/AvatarUpload.tsx`**

```tsx
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUploadAvatar } from "../api/hooks";

interface Props {
  userId: string;
  currentUrl?: string | null;
  fallback: string;
}

export function AvatarUpload({ userId, currentUrl, fallback }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadAvatar(userId);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onError: (err) => setError((err as Error).message ?? "Upload failed"),
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-24 w-24">
        {currentUrl ? <AvatarImage src={currentUrl} alt="avatar" /> : null}
        <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
          aria-label="Avatar file picker"
        />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Change photo"}
        </Button>
        {error && <div className="text-sm text-destructive" role="alert">{error}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `Frontend/src/features/employees/components/ResumeUpload.tsx`**

```tsx
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUploadResume } from "../api/hooks";

interface Props {
  userId: string;
  currentUrl?: string | null;
}

export function ResumeUpload({ userId, currentUrl }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadResume(userId);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onError: (err) => setError((err as Error).message ?? "Upload failed"),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onPick}
          aria-label="Resume PDF picker"
        />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : currentUrl ? "Replace resume" : "Upload resume"}
        </Button>
        {currentUrl && (
          <a href={currentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
            View current PDF
          </a>
        )}
      </div>
      {error && <div className="text-sm text-destructive" role="alert">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/features/employees/
git commit -m "feat(frontend): employees query/mutation hooks + AvatarUpload + ResumeUpload widgets"
```

---

## Task 15: ProfilePage (self)

**Files:**
- Create: `Frontend/src/features/employees/pages/ProfilePage.tsx`
- Create: `Frontend/src/features/employees/pages/ProfilePage.test.tsx`

- [ ] **Step 1: Create `ProfilePage.tsx`**

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/app/hooks";
import { useEmployee, useUpdateEmployee } from "../api/hooks";
import { AvatarUpload } from "../components/AvatarUpload";
import { ResumeUpload } from "../components/ResumeUpload";

export function ProfilePage() {
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployee(me?.id);
  const update = useUpdateEmployee(me?.id ?? "");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  if (!me) return null;
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const fallbackInitials = data.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  function onSave() {
    const patch: Record<string, unknown> = {};
    if (name !== null) patch.name = name;
    if (phone !== null) patch.phone = phone;
    if (bio !== null) patch.bio = bio;
    if (Object.keys(patch).length > 0) update.mutate(patch);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <AvatarUpload userId={data.id} currentUrl={data.avatarUrl} fallback={fallbackInitials} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={data.name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={data.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" defaultValue={data.phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={data.jobTitle ?? ""} disabled />
            </div>
            <div className="col-span-full space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={data.bio ?? ""}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={onSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
        <CardContent>
          <ResumeUpload userId={data.id} currentUrl={data.resumeUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Failing test at `ProfilePage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authSlice, sessionEstablished } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { ProfilePage } from "./ProfilePage";

function build() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  store.dispatch(sessionEstablished({
    accessToken: "t",
    user: { id: "u1", email: "u@b.com", name: "User", role: "EMPLOYEE", isVerified: true },
  }));
  setupApiClient(store, "http://api");
  return { store, qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
}

let store: ReturnType<typeof build>["store"];
let qc: ReturnType<typeof build>["qc"];
let mock: MockAdapter;

beforeEach(() => {
  ({ store, qc } = build());
  mock = new MockAdapter(getApi());
});

const fullProfile = {
  id: "u1", email: "u@b.com", name: "User", role: "EMPLOYEE", isActive: true,
  jobTitle: "Engineer", phone: "555", bio: "hello",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe("ProfilePage", () => {
  it("renders own profile fields", async () => {
    mock.onGet("/employees/u1").reply(200, fullProfile);
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <ProfilePage />
        </QueryClientProvider>
      </Provider>,
    );
    expect(await screen.findByDisplayValue("User")).toBeInTheDocument();
    expect(screen.getByDisplayValue("555")).toBeInTheDocument();
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("PATCH on save", async () => {
    mock.onGet("/employees/u1").reply(200, fullProfile);
    let body: Record<string, unknown> | null = null;
    mock.onPatch("/employees/u1").reply((conf) => {
      body = JSON.parse(conf.data as string);
      return [200, { ...fullProfile, bio: "new bio" }];
    });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <ProfilePage />
        </QueryClientProvider>
      </Provider>,
    );
    const bio = await screen.findByLabelText(/bio/i);
    await userEvent.clear(bio);
    await userEvent.type(bio, "new bio");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.bio).toBe("new bio");
  });
});
```

- [ ] **Step 3: Run, expect 2/2 PASS**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm test src/features/employees/pages/ProfilePage.test.tsx
```

- [ ] **Step 4: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/features/employees/pages/ProfilePage.tsx Frontend/src/features/employees/pages/ProfilePage.test.tsx
git commit -m "feat(frontend): ProfilePage with self-edit fields + avatar/resume widgets"
```

---

## Task 16: PeopleListPage

**Files:**
- Create: `Frontend/src/features/employees/pages/PeopleListPage.tsx`
- Create: `Frontend/src/features/employees/pages/PeopleListPage.test.tsx`

- [ ] **Step 1: Create `PeopleListPage.tsx`**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEmployeesList } from "../api/hooks";
import { useAppSelector } from "@/app/hooks";

export function PeopleListPage() {
  const [q, setQ] = useState("");
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployeesList({ q, page: 1, limit: 50 });
  const canCreate = me?.role === "HR" || me?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>People</CardTitle>
          {canCreate && (
            <Button asChild size="sm"><Link to="/people/new">+ New employee</Link></Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search employees"
          />
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Name</th>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => {
                    const initials = p.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr key={p.id} className={"border-b border-border/50 " + (!p.isActive ? "opacity-50" : "")}>
                        <td className="flex items-center gap-3 py-2">
                          <Avatar className="h-8 w-8">
                            {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          {p.name}
                        </td>
                        <td>{p.jobTitle ?? "—"}</td>
                        <td>{p.departmentName ?? "—"}</td>
                        <td>{p.email}</td>
                        <td><Link to={`/people/${p.id}`} className="text-primary underline-offset-4 hover:underline">View</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.items.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">No employees match your search.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Failing test at `PeopleListPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authSlice, sessionEstablished } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { PeopleListPage } from "./PeopleListPage";

function build() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  store.dispatch(sessionEstablished({
    accessToken: "t",
    user: { id: "u1", email: "u@b.com", name: "U", role: "HR", isVerified: true },
  }));
  setupApiClient(store, "http://api");
  return { store, qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
}

let store: ReturnType<typeof build>["store"];
let qc: ReturnType<typeof build>["qc"];
let mock: MockAdapter;

beforeEach(() => {
  ({ store, qc } = build());
  mock = new MockAdapter(getApi());
});

describe("PeopleListPage", () => {
  it("renders rows from list endpoint", async () => {
    mock.onGet("/employees").reply(200, {
      items: [
        { id: "1", email: "a@b.com", name: "Alice", role: "EMPLOYEE", isActive: true, jobTitle: "Eng", departmentName: "Eng" },
        { id: "2", email: "b@b.com", name: "Bob", role: "EMPLOYEE", isActive: true, jobTitle: "PM", departmentName: "Product" },
      ],
      total: 2, page: 1, limit: 50,
    });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter><PeopleListPage /></MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("HR sees the New employee button", async () => {
    mock.onGet("/employees").reply(200, { items: [], total: 0, page: 1, limit: 50 });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter><PeopleListPage /></MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );
    expect(await screen.findByRole("link", { name: /new employee/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, 2/2 PASS**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm test src/features/employees/pages/PeopleListPage.test.tsx
```

- [ ] **Step 4: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/features/employees/pages/PeopleListPage.tsx Frontend/src/features/employees/pages/PeopleListPage.test.tsx
git commit -m "feat(frontend): PeopleListPage with search + HR-gated New Employee link"
```

---

## Task 17: EmployeeDetailPage

**Files:**
- Create: `Frontend/src/features/employees/pages/EmployeeDetailPage.tsx`

- [ ] **Step 1: Create `EmployeeDetailPage.tsx`**

```tsx
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/app/hooks";
import { useEmployee, useDeactivateEmployee, type FullProfile } from "../api/hooks";

function isFullProfile(p: FullProfile | { id: string }): p is FullProfile {
  return "createdAt" in p;
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployee(id);
  const deactivate = useDeactivateEmployee();
  const elevated = me?.role === "HR" || me?.role === "ADMIN";

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const initials = data.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const showFull = isFullProfile(data) && !!(data as FullProfile).createdAt;
  const full = data as FullProfile;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{data.name}</CardTitle>
              <div className="text-muted-foreground">{data.jobTitle ?? "—"} · {data.departmentName ?? "—"}</div>
              {!data.isActive && <span className="text-sm text-destructive">Inactive</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Email" value={data.email} />
          <Field label="Role" value={data.role} />
          <Field label="Phone" value={data.phone ?? "—"} />
          <Field label="Bio" value={data.bio ?? "—"} />
        </CardContent>
      </Card>

      {showFull && (
        <Card>
          <CardHeader><CardTitle>Sensitive details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Hire date" value={full.hireDate ? new Date(full.hireDate).toLocaleDateString() : "—"} />
            <Field label="Date of birth" value={full.dateOfBirth ? new Date(full.dateOfBirth).toLocaleDateString() : "—"} />
            <Field label="Address" value={full.address ?? "—"} />
            <Field label="Employment type" value={full.employmentType ?? "—"} />
            <Field label="Emergency contact" value={
              full.emergencyContact
                ? `${full.emergencyContact.name} (${full.emergencyContact.relationship}) · ${full.emergencyContact.phone}`
                : "—"
            } />
            <Field label="Resume" value={full.resumeUrl ? "uploaded" : "—"} link={full.resumeUrl ?? undefined} />
          </CardContent>
        </Card>
      )}

      {elevated && data.isActive && data.id !== me?.id && (
        <Button variant="destructive" onClick={() => deactivate.mutate(data.id)} disabled={deactivate.isPending}>
          {deactivate.isPending ? "Deactivating…" : "Deactivate employee"}
        </Button>
      )}
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="grid grid-cols-3 items-center text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">
        {link ? <a href={link} target="_blank" rel="noreferrer" className="text-primary underline">{value}</a> : value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/features/employees/pages/EmployeeDetailPage.tsx
git commit -m "feat(frontend): EmployeeDetailPage with public + elevated-only sensitive section"
```

---

## Task 18: CreateEmployeePage + DepartmentsPage (HR/Admin)

**Files:**
- Create: `Frontend/src/features/employees/pages/CreateEmployeePage.tsx`
- Create: `Frontend/src/features/employees/pages/DepartmentsPage.tsx`

- [ ] **Step 1: Create `CreateEmployeePage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateEmployee, useDepartmentsList } from "../api/hooks";

export function CreateEmployeePage() {
  const navigate = useNavigate();
  const create = useCreateEmployee();
  const depts = useDepartmentsList();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "HR" | "PM" | "ADMIN">("EMPLOYEE");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate(
      { email, name, role, jobTitle: jobTitle || undefined, departmentId: departmentId || undefined },
      {
        onSuccess: (created) => navigate(`/people/${created.id}`),
        onError: (err) => setError((err as Error).message ?? "Failed"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>New employee</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as never)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="PM">Project Manager</option>
                <option value="HR">HR</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <select
                id="departmentId"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {depts.data?.items.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create employee"}
            </Button>
            <p className="text-sm text-muted-foreground">
              The temp password is logged on the backend (`info` level). Email invites are coming with sub-project #2.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `DepartmentsPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartmentsList, useCreateDepartment } from "../api/hooks";

export function DepartmentsPage() {
  const list = useDepartmentsList();
  const create = useCreateDepartment();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate(
      { name, code },
      {
        onSuccess: () => { setName(""); setCode(""); },
        onError: (err) => setError((err as Error).message ?? "Failed"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader><CardTitle>Create department</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code (slug)</Label>
              <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="eng" />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
            {error && <div className="col-span-full text-sm text-destructive" role="alert">{error}</div>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
        <CardContent>
          {list.isLoading || !list.data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th>Code</th>
                  <th>Manager</th>
                  <th>Employees</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2">{d.name}</td>
                    <td>{d.code}</td>
                    <td>{d.managerName ?? "—"}</td>
                    <td>{d.employeeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/features/employees/pages/CreateEmployeePage.tsx Frontend/src/features/employees/pages/DepartmentsPage.tsx
git commit -m "feat(frontend): CreateEmployeePage + DepartmentsPage (HR/Admin)"
```

---

## Task 19: Sidebar update + App.tsx routing

**Files:**
- Modify: `Frontend/src/components/layout/Sidebar.tsx`
- Modify: `Frontend/src/App.tsx`

- [ ] **Step 1: Replace `Sidebar.tsx` with the new ordering**

```tsx
import { NavLink } from "react-router-dom";
import {
  User,
  Users,
  Building2,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  CalendarClock,
  Receipt,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { Separator } from "@/components/ui/separator";
import { RoleGate } from "@/features/auth/RoleGate";

const ACTIVE_NAV = [
  { to: "/profile", label: "Profile", Icon: User, roles: undefined },
  { to: "/people", label: "People", Icon: Users, roles: undefined },
  { to: "/departments", label: "Departments", Icon: Building2, roles: ["HR", "ADMIN"] as const },
];

const STUB_NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/messages", label: "Messages", Icon: MessageSquare },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock },
  { to: "/expenses", label: "Expenses", Icon: Receipt },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign },
];

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-4 py-5">
        <Logo isClickable showTagline={false} />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {ACTIVE_NAV.map(({ to, label, Icon, roles }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          );
          return roles
            ? <RoleGate key={to} roles={roles as unknown as ("HR"|"ADMIN")[]}>{link}</RoleGate>
            : link;
        })}
        <Separator className="my-2" />
        <div className="px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">Coming soon</div>
        {STUB_NAV.map(({ to, label, Icon }) => (
          <div
            key={to}
            className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground opacity-50"
            title={`${label} — coming soon`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Update `Frontend/src/App.tsx` — add new routes**

Replace the `<Routed>` function body to:

```tsx
function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/people" element={<PeopleListPage />} />
          <Route
            path="/people/new"
            element={
              <RoleGate roles={["HR", "ADMIN"]} fallback={<EmptyState label="Forbidden" hint="HR or Admin only." />}>
                <CreateEmployeePage />
              </RoleGate>
            }
          />
          <Route path="/people/:id" element={<EmployeeDetailPage />} />
          <Route
            path="/departments"
            element={
              <RoleGate roles={["HR", "ADMIN"]} fallback={<EmptyState label="Forbidden" hint="HR or Admin only." />}>
                <DepartmentsPage />
              </RoleGate>
            }
          />
          <Route path="/dashboard" element={<EmptyState label="Dashboard" />} />
          <Route path="/tasks" element={<EmptyState label="Tasks" />} />
          <Route path="/messages" element={<EmptyState label="Messages" />} />
          <Route path="/attendance" element={<EmptyState label="Attendance" />} />
          <Route path="/expenses" element={<EmptyState label="Expenses" />} />
          <Route path="/payroll" element={<EmptyState label="Payroll" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

Also add the new imports at the top of `App.tsx`:

```tsx
import { ProfilePage } from "@/features/employees/pages/ProfilePage";
import { PeopleListPage } from "@/features/employees/pages/PeopleListPage";
import { EmployeeDetailPage } from "@/features/employees/pages/EmployeeDetailPage";
import { CreateEmployeePage } from "@/features/employees/pages/CreateEmployeePage";
import { DepartmentsPage } from "@/features/employees/pages/DepartmentsPage";
import { RoleGate } from "@/features/auth/RoleGate";
```

- [ ] **Step 3: Run all FE tests**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm test
```

Expected: 26 (Foundation) + 3 (RoleGate) + 2 (ProfilePage) + 2 (PeopleListPage) = **33** passing.

- [ ] **Step 4: Type-check + build**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project/Frontend && pnpm exec tsc -b && pnpm build
```

Expected: zero errors, dist produced.

- [ ] **Step 5: Commit**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
git add Frontend/src/components/layout/Sidebar.tsx Frontend/src/App.tsx
git commit -m "feat(frontend): Sidebar reordered with Profile/People/Departments + 5 routes wired"
```

---

## Task 20: End-to-end smoke + tag

- [ ] **Step 1: Bring everything up**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
brew services list | grep mongo  # ensure mongo is started
pnpm seed
./dev.sh
```

- [ ] **Step 2: Manual smoke**

In a browser, log in as `admin@sms-ip.local` / `ChangeMe-Admin-1!`:

1. Sidebar shows Profile / People / Departments at top, Coming-soon stubs below.
2. `/profile` shows your fields, you can change `bio` and click Save → success.
3. Click "Change photo" → upload any small PNG → avatar visible immediately at `<img src="http://localhost:3000/files/avatar/…">`.
4. Upload a small PDF as resume → the View link works.
5. `/departments` (visible because admin) → create "Engineering" with code "eng" → row appears.
6. `/people` → click "+ New employee" → create `alice@sms-ip.local` with role `EMPLOYEE` and dept Engineering. Watch the backend log — it shows the temp password.
7. In a private window, log out, log in as `alice@sms-ip.local` with the temp password.
8. Visit `/people/<admin-id>` → admin's `dateOfBirth` and `address` are NOT shown (alice is not HR/Admin and not self).
9. Sidebar does NOT show `Departments` for alice.
10. Visit `/departments` directly → Forbidden EmptyState renders.

- [ ] **Step 3: Regenerate orval client one more time + run all tests + tag**

```bash
cd /Users/anas/Documents/Code/sehetmeyer/global-neo-chain-project
pnpm gen:api  # ensure FE generated client has the latest spec
pnpm test     # BE + FE combined
pnpm --dir Backend exec tsc -p tsconfig.json --noEmit
pnpm --dir Frontend exec tsc -b
git tag em-done
git tag --list 'em-*'
```

- [ ] **Step 4: Commit any orval-generated changes? (No — `Frontend/src/api/generated/` is gitignored.)**

The `em-done` tag marks the end of sub-project #3.

---

## Definition of Done (Employee Management overall)

- All 16 endpoints registered in OpenAPI; `/docs` lists them under `employees`, `departments`, `positions` tags.
- `pnpm gen:api` produces `Frontend/src/api/generated/{auth,health,employees,departments,positions,model}/`.
- Backend: ≥40 new tests (target ~89 total), zero tsc errors, build clean.
- Frontend: ≥7 new tests (target ~33 total), zero tsc errors, build clean.
- Manual smoke (Task 20 §2) passes 1–10.
- Tags `em-backend-done` and `em-done` exist on the branch.

When all checked, sub-project #3 is complete and the project is ready for sub-project #4 (Tasks / Jira-lite kanban) or any other module per the decomposition.
