# Foundation Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Backend half of Foundation — a TypeScript Express 5 server with Zod-OpenAPI/Swagger, JWT auth (login + refresh-rotation + logout + me), Socket.io namespace stubs, and smoke tests proving every layer works.

**Architecture:** Modular Express 5 app composed in `app.ts`, started in `server.ts` after binding Socket.io to a shared HTTP server. Auth uses access JWT in JSON + refresh JWT in HttpOnly cookie at `Path=/auth`, with rotation tracked in a `RefreshToken` collection (jti+family) for reuse detection. OpenAPI spec is built from Zod schemas at boot via `@asteasolutions/zod-to-openapi` and served at `/docs`.

**Tech Stack:** Node 20, TypeScript (ESM), Express 5, Mongoose 8, Zod, `@asteasolutions/zod-to-openapi`, swagger-ui-express, jsonwebtoken, bcrypt, helmet, cors, express-rate-limit, cookie-parser, pino, Socket.io, Vitest, Supertest, mongodb-memory-server (tests only).

**Reference spec:** `docs/superpowers/specs/2026-04-25-foundation-design.md` — read it first.

**Pre-task: clean slate.** Before Task 1, the executor MUST run `rm -rf Backend && mkdir Backend` from the repo root. The existing `Backend/` directory is the broken JS scaffold the spec mandates we replace; everything below assumes a fresh empty `Backend/`.

---

## Task 1: Bootstrap TS project + config layer

**Files:**
- Create: `Backend/package.json`
- Create: `Backend/tsconfig.json`
- Create: `Backend/.env.example`
- Create: `Backend/.env`
- Create: `Backend/vitest.config.ts`
- Create: `Backend/src/config/index.ts`
- Create: `Backend/src/config/index.test.ts`
- Create: `Backend/.gitignore`

- [ ] **Step 1: Create `Backend/package.json`**

```json
{
  "name": "ems-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "tsx src/seed.ts",
    "gen:spec": "tsx src/openapi/emit.ts"
  },
  "dependencies": {
    "@asteasolutions/zod-to-openapi": "^7.3.4",
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.0.0",
    "express": "^5.0.1",
    "express-rate-limit": "^7.4.1",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.8.0",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0",
    "pino-pretty": "^11.3.0",
    "socket.io": "^4.8.1",
    "swagger-ui-express": "^5.0.1",
    "uuid": "^11.0.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.9.0",
    "@types/supertest": "^6.0.2",
    "@types/swagger-ui-express": "^4.1.7",
    "@types/uuid": "^10.0.0",
    "mongodb-memory-server": "^10.1.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

Note: zod is pinned to `^3.23.8` because `@asteasolutions/zod-to-openapi` v7 expects zod 3.x. The spec says we use Zod; this is the version compatible with the OpenAPI emitter.

- [ ] **Step 2: Create `Backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Create `Backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 4: Create `Backend/.env.example`**

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/ems
FRONTEND_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
SEED_ADMIN_EMAIL=admin@sms-ip.local
SEED_ADMIN_PASSWORD=ChangeMe-Admin-1!
NODE_ENV=development
LOG_LEVEL=debug
```

- [ ] **Step 5: Copy `.env.example` to `.env`**

```bash
cp Backend/.env.example Backend/.env
```

- [ ] **Step 6: Create `Backend/.gitignore`**

```
node_modules
dist
coverage
.env
openapi.json
```

- [ ] **Step 7: Write the failing config test**

Create `Backend/src/config/index.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const REQUIRED = {
  PORT: "3000",
  MONGO_URI: "mongodb://localhost:27017/ems-test",
  FRONTEND_ORIGIN: "http://localhost:5173",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "7d",
  SEED_ADMIN_EMAIL: "admin@example.com",
  SEED_ADMIN_PASSWORD: "Strong-Pass-1!",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
};

describe("config", () => {
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    saved = { ...process.env };
  });

  afterEach(() => {
    process.env = saved;
  });

  it("parses a valid environment", async () => {
    Object.assign(process.env, REQUIRED);
    const { loadConfig } = await import("./index.js");
    const cfg = loadConfig();
    expect(cfg.PORT).toBe(3000);
    expect(cfg.MONGO_URI).toBe(REQUIRED.MONGO_URI);
    expect(cfg.NODE_ENV).toBe("test");
  });

  it("throws when a required secret is missing", async () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.JWT_ACCESS_SECRET;
    const { loadConfig } = await import("./index.js");
    expect(() => loadConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects a JWT secret shorter than 32 characters", async () => {
    Object.assign(process.env, REQUIRED, { JWT_ACCESS_SECRET: "short" });
    const { loadConfig } = await import("./index.js");
    expect(() => loadConfig()).toThrow();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

```bash
cd Backend && pnpm install && pnpm test
```

Expected: FAIL — `Cannot find module './index.js'`.

- [ ] **Step 9: Create `Backend/src/config/index.ts`**

```ts
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().url().or(z.string().startsWith("mongodb")),
  FRONTEND_ORIGIN: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >=32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be >=32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(8),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}

export const config: Config = loadConfig();
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
cd Backend && pnpm test
```

Expected: PASS — 3 tests in `config/index.test.ts`.

- [ ] **Step 11: Commit**

```bash
git add Backend/ .gitignore
git commit -m "feat(backend): bootstrap TS project + Zod-validated config"
```

---

## Task 2: Logger and error library

**Files:**
- Create: `Backend/src/lib/logger.ts`
- Create: `Backend/src/lib/errors.ts`
- Create: `Backend/src/lib/errors.test.ts`

- [ ] **Step 1: Create `Backend/src/lib/logger.ts`**

```ts
import pino from "pino";
import { config } from "../config/index.js";

const isDev = config.NODE_ENV === "development";

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
});
```

- [ ] **Step 2: Write the failing errors test**

Create `Backend/src/lib/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./errors.js";

describe("AppError", () => {
  it("captures statusCode, code, message, details", () => {
    const err = new AppError(418, "TEAPOT", "I'm a teapot", { hot: true });
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("TEAPOT");
    expect(err.message).toBe("I'm a teapot");
    expect(err.details).toEqual({ hot: true });
    expect(err).toBeInstanceOf(Error);
  });

  it("ValidationError defaults to 400 + VALIDATION", () => {
    const err = new ValidationError("bad", { field: "email" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION");
    expect(err.details).toEqual({ field: "email" });
  });

  it("UnauthorizedError defaults to 401 + UNAUTHORIZED", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("ForbiddenError defaults to 403 + FORBIDDEN", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("NotFoundError defaults to 404 + NOT_FOUND", () => {
    const err = new NotFoundError("user");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("user not found");
  });

  it("ConflictError defaults to 409 + CONFLICT", () => {
    const err = new ConflictError("email already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd Backend && pnpm test src/lib/errors.test.ts
```

Expected: FAIL — `Cannot find module './errors.js'`.

- [ ] **Step 4: Create `Backend/src/lib/errors.ts`**

```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(400, "VALIDATION", message, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(404, "NOT_FOUND", `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, "CONFLICT", message);
    this.name = "ConflictError";
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd Backend && pnpm test src/lib/errors.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/lib/
git commit -m "feat(backend): logger + AppError hierarchy"
```

---

## Task 3: Token library (sign / verify / rotate)

**Files:**
- Create: `Backend/src/lib/tokens.ts`
- Create: `Backend/src/lib/tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `Backend/src/lib/tokens.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "1h",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
});

describe("tokens", () => {
  it("signs and verifies an access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./tokens.js");
    const token = signAccessToken({ sub: "user-1", role: "ADMIN" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
  });

  it("throws on a tampered access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./tokens.js");
    const token = signAccessToken({ sub: "user-1", role: "ADMIN" });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("signs a refresh token with jti and family", async () => {
    const { signRefreshToken, verifyRefreshToken, newJti } = await import("./tokens.js");
    const jti = newJti();
    const family = newJti();
    const token = signRefreshToken({ sub: "user-1", jti, family });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.jti).toBe(jti);
    expect(payload.family).toBe(family);
  });

  it("newJti returns a unique string each call", async () => {
    const { newJti } = await import("./tokens.js");
    const a = newJti();
    const b = newJti();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Backend && pnpm test src/lib/tokens.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `Backend/src/lib/tokens.ts`**

```ts
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../config/index.js";

export interface AccessPayload {
  sub: string;
  role: string;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  family: string;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
  if (typeof decoded !== "object" || !decoded) throw new Error("invalid token");
  const { sub, role } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof role !== "string") throw new Error("invalid payload");
  return { sub, role };
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);
  if (typeof decoded !== "object" || !decoded) throw new Error("invalid token");
  const { sub, jti, family } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof jti !== "string" || typeof family !== "string") {
    throw new Error("invalid payload");
  }
  return { sub, jti, family };
}

export function newJti(): string {
  return uuid();
}
```

- [ ] **Step 4: Run tests**

```bash
cd Backend && pnpm test src/lib/tokens.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/lib/tokens.ts Backend/src/lib/tokens.test.ts
git commit -m "feat(backend): JWT sign/verify helpers + jti generator"
```

---

## Task 4: Mongoose connect + User and RefreshToken models

**Files:**
- Create: `Backend/src/db/index.ts`
- Create: `Backend/src/models/user.model.ts`
- Create: `Backend/src/models/refreshToken.model.ts`
- Create: `Backend/src/test/setup.ts`
- Create: `Backend/src/models/user.model.test.ts`

- [ ] **Step 1: Create `Backend/src/db/index.ts`**

```ts
import mongoose from "mongoose";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

export async function connectDb(uri: string = config.MONGO_URI): Promise<void> {
  await mongoose.connect(uri);
  logger.info({ host: mongoose.connection.host }, "mongo connected");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
```

- [ ] **Step 2: Create `Backend/src/models/user.model.ts`**

```ts
import { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const ROLES = ["ADMIN", "HR", "EMPLOYEE", "PM"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "EMPLOYEE" },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import("mongoose").Types.ObjectId };
export type UserModel = Model<UserDoc>;

export const User: UserModel = model<UserDoc>("User", userSchema);
```

- [ ] **Step 3: Create `Backend/src/models/refreshToken.model.ts`**

```ts
import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    family: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & {
  _id: Types.ObjectId;
};
export type RefreshTokenModel = Model<RefreshTokenDoc>;

export const RefreshToken: RefreshTokenModel = model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
```

- [ ] **Step 4: Create `Backend/src/test/setup.ts`** (in-memory Mongo for tests)

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongo: MongoMemoryServer | null = null;

export async function startTestDb(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

export async function stopTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
  mongo = null;
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]!.deleteMany({});
  }
}
```

- [ ] **Step 5: Write the failing model test**

Create `Backend/src/models/user.model.test.ts`:

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

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("User model", () => {
  it("creates a user with default role EMPLOYEE", async () => {
    const { User } = await import("./user.model.js");
    const u = await User.create({ email: "A@B.COM", passwordHash: "x", name: "A" });
    expect(u.email).toBe("a@b.com");
    expect(u.role).toBe("EMPLOYEE");
    expect(u.isVerified).toBe(false);
  });

  it("rejects duplicate emails", async () => {
    const { User } = await import("./user.model.js");
    await User.create({ email: "a@b.com", passwordHash: "x", name: "A" });
    await expect(User.create({ email: "a@b.com", passwordHash: "y", name: "B" })).rejects.toThrow();
  });

  it("rejects invalid role", async () => {
    const { User } = await import("./user.model.js");
    await expect(
      User.create({ email: "a@b.com", passwordHash: "x", name: "A", role: "BOSS" as never }),
    ).rejects.toThrow();
  });

  it("does not return passwordHash by default", async () => {
    const { User } = await import("./user.model.js");
    await User.create({ email: "a@b.com", passwordHash: "secret", name: "A" });
    const fetched = await User.findOne({ email: "a@b.com" });
    expect(fetched?.passwordHash).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd Backend && pnpm test src/models/user.model.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add Backend/src/db/ Backend/src/models/ Backend/src/test/
git commit -m "feat(backend): mongo connect helper + User/RefreshToken models"
```

---

## Task 5: Validate + central error middleware

**Files:**
- Create: `Backend/src/middleware/validate.ts`
- Create: `Backend/src/middleware/error.ts`
- Create: `Backend/src/middleware/validate.test.ts`
- Create: `Backend/src/middleware/error.test.ts`

- [ ] **Step 1: Create `Backend/src/middleware/validate.ts`**

```ts
import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../lib/errors.js";

declare module "express-serve-static-core" {
  interface Request {
    validated?: unknown;
  }
}

export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError("Validation failed", result.error.flatten()));
    }
    req.validated = result.data;
    next();
  };
}
```

- [ ] **Step 2: Create `Backend/src/middleware/error.ts`**

```ts
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ code: err.code, message: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ code: "VALIDATION", message: "Validation failed", details: err.flatten() });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res
      .status(400)
      .json({ code: "VALIDATION", message: err.message, details: err.errors });
  }

  if ((err as { code?: number })?.code === 11000) {
    const field = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0];
    return res
      .status(409)
      .json({ code: "CONFLICT", message: `Duplicate value for ${field ?? "field"}` });
  }

  logger.error({ err }, "unhandled error");
  return res.status(500).json({ code: "INTERNAL", message: "Internal server error" });
};
```

- [ ] **Step 3: Write failing tests for validate**

Create `Backend/src/middleware/validate.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";

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

describe("validate middleware", () => {
  it("attaches parsed data to req.validated and passes through", async () => {
    const { validate } = await import("./validate.js");
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.use(express.json());
    const schema = z.object({ name: z.string() });
    app.post("/", validate(schema), (req, res) => res.json({ data: req.validated }));
    app.use(errorHandler);
    const res = await request(app).post("/").send({ name: "Ana" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { name: "Ana" } });
  });

  it("returns 400 with VALIDATION code on bad body", async () => {
    const { validate } = await import("./validate.js");
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.use(express.json());
    const schema = z.object({ age: z.number() });
    app.post("/", validate(schema), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).post("/").send({ age: "not-a-number" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.details).toBeDefined();
  });
});
```

- [ ] **Step 4: Write failing tests for errorHandler**

Create `Backend/src/middleware/error.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

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

describe("error middleware", () => {
  it("renders AppError with code+message+details", async () => {
    const { errorHandler } = await import("./error.js");
    const { NotFoundError } = await import("../lib/errors.js");
    const app = express();
    app.get("/", (_req, _res, next) => next(new NotFoundError("widget")));
    app.use(errorHandler);
    const res = await request(app).get("/");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "NOT_FOUND", message: "widget not found" });
  });

  it("renders unknown errors as 500 INTERNAL", async () => {
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.get("/", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);
    const res = await request(app).get("/");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd Backend && pnpm test src/middleware/
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/middleware/
git commit -m "feat(backend): validate + central error middleware"
```

---

## Task 6: Auth + requireRole middleware

**Files:**
- Create: `Backend/src/middleware/auth.ts`
- Create: `Backend/src/middleware/requireRole.ts`
- Create: `Backend/src/middleware/auth.test.ts`

- [ ] **Step 1: Create `Backend/src/middleware/auth.ts`**

```ts
import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/tokens.js";
import { UnauthorizedError } from "../lib/errors.js";
import type { Role } from "../models/user.model.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: Role };
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing bearer token"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role as Role };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
};
```

- [ ] **Step 2: Create `Backend/src/middleware/requireRole.ts`**

```ts
import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { Role } from "../models/user.model.js";

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!allowed.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}
```

- [ ] **Step 3: Write the failing tests**

Create `Backend/src/middleware/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

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

describe("auth + requireRole middleware", () => {
  it("rejects requests without bearer", async () => {
    const { requireAuth } = await import("./auth.js");
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
  });

  it("accepts a valid bearer and exposes req.user", async () => {
    const { requireAuth } = await import("./auth.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "ADMIN" });
    const app = express();
    app.get("/", requireAuth, (req, res) => res.json(req.user));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "u1", role: "ADMIN" });
  });

  it("requireRole allows when role matches", async () => {
    const { requireAuth } = await import("./auth.js");
    const { requireRole } = await import("./requireRole.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "ADMIN" });
    const app = express();
    app.get("/", requireAuth, requireRole("ADMIN"), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("requireRole rejects when role does not match", async () => {
    const { requireAuth } = await import("./auth.js");
    const { requireRole } = await import("./requireRole.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "EMPLOYEE" });
    const app = express();
    app.get("/", requireAuth, requireRole("ADMIN"), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd Backend && pnpm test src/middleware/auth.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/middleware/auth.ts Backend/src/middleware/requireRole.ts Backend/src/middleware/auth.test.ts
git commit -m "feat(backend): requireAuth + requireRole middleware"
```

---

## Task 7: OpenAPI registry + spec build

**Files:**
- Create: `Backend/src/openapi/registry.ts`
- Create: `Backend/src/openapi/spec.ts`
- Create: `Backend/src/openapi/emit.ts`

- [ ] **Step 1: Create `Backend/src/openapi/registry.ts`**

```ts
import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
```

- [ ] **Step 2: Create `Backend/src/openapi/spec.ts`**

```ts
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.js";

export function buildOpenApiDocument(): object {
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "EMS API",
      version: "0.1.0",
      description: "Employee Management System API",
    },
    servers: [{ url: "/" }],
  });
}
```

- [ ] **Step 3: Create `Backend/src/openapi/emit.ts`** (CLI entry to write spec to disk)

```ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import "../modules/auth/auth.schema.js";
import "../modules/health/health.routes.js";
import { buildOpenApiDocument } from "./spec.js";

const out = resolve(process.cwd(), "openapi.json");
writeFileSync(out, JSON.stringify(buildOpenApiDocument(), null, 2));
console.log(`wrote ${out}`);
```

(Imports of `auth.schema` and `health.routes` are required because they perform `registry.register*` as a side effect at import time; both files are created in later tasks. If running `gen:spec` before those tasks complete, comment those imports.)

- [ ] **Step 4: Commit (no test yet — full integration tested in Task 12)**

```bash
git add Backend/src/openapi/
git commit -m "feat(backend): OpenAPI registry + document builder"
```

---

## Task 8: Auth schemas (Zod + OpenAPI registration)

**Files:**
- Create: `Backend/src/modules/auth/auth.schema.ts`

- [ ] **Step 1: Create `Backend/src/modules/auth/auth.schema.ts`**

```ts
import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { ROLES } from "../../models/user.model.js";

export const LoginBody = z
  .object({
    email: z.string().email().openapi({ example: "admin@sms-ip.local" }),
    password: z.string().min(1).openapi({ example: "ChangeMe-Admin-1!" }),
  })
  .openapi("LoginBody");

export const PublicUser = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(ROLES),
    isVerified: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PublicUser");

export const AccessTokenResponse = z
  .object({
    accessToken: z.string(),
  })
  .openapi("AccessTokenResponse");

export const LoginResponse = AccessTokenResponse.extend({
  user: PublicUser,
}).openapi("LoginResponse");

export const ErrorResponse = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .openapi("ErrorResponse");

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["auth"],
  request: { body: { content: { "application/json": { schema: LoginBody } } } },
  responses: {
    200: { description: "OK", ...json(LoginResponse) },
    401: { description: "Invalid credentials", ...json(ErrorResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["auth"],
  responses: {
    200: { description: "Rotated", ...json(AccessTokenResponse) },
    401: { description: "Invalid refresh", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["auth"],
  responses: {
    204: { description: "Logged out" },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Current user", ...json(z.object({ user: PublicUser })) },
    401: { description: "Unauthorized", ...json(ErrorResponse) },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add Backend/src/modules/auth/auth.schema.ts
git commit -m "feat(backend): auth Zod schemas registered with OpenAPI"
```

---

## Task 9: Auth service (login / refresh-with-rotation / logout / me)

**Files:**
- Create: `Backend/src/modules/auth/auth.service.ts`
- Create: `Backend/src/modules/auth/auth.service.test.ts`

- [ ] **Step 1: Create `Backend/src/modules/auth/auth.service.ts`**

```ts
import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { User, type Role } from "../../models/user.model.js";
import { RefreshToken } from "../../models/refreshToken.model.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newJti,
} from "../../lib/tokens.js";
import { UnauthorizedError } from "../../lib/errors.js";

// Mirror of JWT_REFRESH_TTL ("7d") expressed in ms for the DB expiresAt index.
// If you change JWT_REFRESH_TTL in env, update this too.
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) throw new UnauthorizedError("Invalid credentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  const family = newJti();
  return issueTokens(user._id, user.role, family, {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: (user as unknown as { createdAt: Date }).createdAt,
    updatedAt: (user as unknown as { updatedAt: Date }).updatedAt,
  });
}

export async function rotate(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh");
  }

  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored) throw new UnauthorizedError("Unknown refresh");

  if (stored.revokedAt !== null) {
    await RefreshToken.updateMany(
      { family: stored.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new UnauthorizedError("Refresh reuse detected");
  }

  const user = await User.findById(stored.userId);
  if (!user) throw new UnauthorizedError("User not found");

  const newRefreshJti = newJti();
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id.toString(), jti: newRefreshJti, family: stored.family });

  stored.revokedAt = new Date();
  stored.replacedBy = newRefreshJti;
  await stored.save();

  await RefreshToken.create({
    jti: newRefreshJti,
    family: stored.family,
    userId: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  return { accessToken, refreshToken };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    await RefreshToken.updateMany(
      { family: payload.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  } catch {
    // ignore; logout is best-effort
  }
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("User not found");
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: (user as unknown as { createdAt: Date }).createdAt,
    updatedAt: (user as unknown as { updatedAt: Date }).updatedAt,
  };
}

async function issueTokens(
  userId: Types.ObjectId,
  role: Role,
  family: string,
  publicUser: AuthPayload["user"],
): Promise<AuthPayload> {
  const jti = newJti();
  const accessToken = signAccessToken({ sub: userId.toString(), role });
  const refreshToken = signRefreshToken({ sub: userId.toString(), jti, family });
  await RefreshToken.create({
    jti,
    family,
    userId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken, user: publicUser };
}
```

- [ ] **Step 2: Write the failing service tests**

Create `Backend/src/modules/auth/auth.service.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
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

async function seedUser(email: string, password: string) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash(password, 4),
    name: "Test",
    role: "ADMIN",
  });
}

describe("auth.service", () => {
  it("login returns access + refresh + user on valid credentials", async () => {
    await seedUser("a@b.com", "pw");
    const { login } = await import("./auth.service.js");
    const out = await login("A@B.COM", "pw");
    expect(out.accessToken).toBeTruthy();
    expect(out.refreshToken).toBeTruthy();
    expect(out.user.email).toBe("a@b.com");
  });

  it("login rejects wrong password", async () => {
    await seedUser("a@b.com", "pw");
    const { login } = await import("./auth.service.js");
    await expect(login("a@b.com", "wrong")).rejects.toThrow();
  });

  it("login rejects unknown email", async () => {
    const { login } = await import("./auth.service.js");
    await expect(login("nope@b.com", "pw")).rejects.toThrow();
  });

  it("rotate issues new tokens and revokes old refresh", async () => {
    await seedUser("a@b.com", "pw");
    const { login, rotate } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");
    const second = await rotate(first.refreshToken);
    expect(second.accessToken).toBeTruthy();
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const stored = await RefreshToken.find({});
    const revoked = stored.filter((t) => t.revokedAt !== null);
    expect(revoked.length).toBe(1);
  });

  it("rotate detects refresh reuse and revokes the family", async () => {
    await seedUser("a@b.com", "pw");
    const { login, rotate } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");
    await rotate(first.refreshToken);
    await expect(rotate(first.refreshToken)).rejects.toThrow(/reuse/i);
    const remaining = await RefreshToken.find({ revokedAt: null });
    expect(remaining.length).toBe(0);
  });

  it("logout revokes the family", async () => {
    await seedUser("a@b.com", "pw");
    const { login, logout } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");
    await logout(first.refreshToken);
    const remaining = await RefreshToken.find({ revokedAt: null });
    expect(remaining.length).toBe(0);
  });

  it("getMe returns current user shape", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { getMe } = await import("./auth.service.js");
    const me = await getMe(u._id.toString());
    expect(me.email).toBe("a@b.com");
    expect(me.role).toBe("ADMIN");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd Backend && pnpm test src/modules/auth/auth.service.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/modules/auth/auth.service.ts Backend/src/modules/auth/auth.service.test.ts
git commit -m "feat(backend): auth service with refresh rotation + reuse detection"
```

---

## Task 10: Auth controller + routes + integration tests

**Files:**
- Create: `Backend/src/modules/auth/auth.controller.ts`
- Create: `Backend/src/modules/auth/auth.routes.ts`
- Create: `Backend/src/modules/auth/auth.routes.test.ts`
- Create: `Backend/src/middleware/rateLimit.ts`

- [ ] **Step 1: Create `Backend/src/middleware/rateLimit.ts`**

```ts
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many auth attempts" },
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
```

- [ ] **Step 2: Create `Backend/src/modules/auth/auth.controller.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/index.js";
import { login as loginSvc, rotate, logout as logoutSvc, getMe } from "./auth.service.js";
import type { z } from "zod";
import type { LoginBody } from "./auth.schema.js";
import { UnauthorizedError } from "../../lib/errors.js";

type LoginInput = z.infer<typeof LoginBody>;

const REFRESH_COOKIE = "refresh";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/auth",
    maxAge: REFRESH_TTL_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
}

export async function postLogin(req: Request, res: Response, next: NextFunction) {
  try {
    // validate(LoginBody) middleware already parsed the body and put it on req.validated
    const body = req.validated as LoginInput;
    const { accessToken, refreshToken, user } = await loginSvc(body.email, body.password);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
}

export async function postRefresh(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedError("Missing refresh cookie");
    const { accessToken, refreshToken } = await rotate(raw);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

export async function postLogout(req: Request, res: Response, next: NextFunction) {
  try {
    await logoutSvc(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getCurrent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const user = await getMe(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 3: Create `Backend/src/modules/auth/auth.routes.ts`**

```ts
import { Router } from "express";
import { postLogin, postRefresh, postLogout, getCurrent } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { LoginBody } from "./auth.schema.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/login", authLimiter, validate(LoginBody), postLogin);
authRouter.post("/refresh", authLimiter, postRefresh);
authRouter.post("/logout", postLogout);
authRouter.get("/me", requireAuth, getCurrent);
```

- [ ] **Step 4: Create `Backend/src/app.ts`** (composition root used by tests AND server.ts)

```ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import "./modules/auth/auth.schema.js";
import { buildOpenApiDocument } from "./openapi/spec.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(globalLimiter);

  const openapi = buildOpenApiDocument();
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 5: Write the failing route tests**

Create `Backend/src/modules/auth/auth.routes.test.ts`:

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

async function seedAdmin() {
  const { User } = await import("../../models/user.model.js");
  await User.create({
    email: "admin@sms-ip.local",
    passwordHash: await bcrypt.hash("ChangeMe-Admin-1!", 4),
    name: "Admin",
    role: "ADMIN",
  });
}

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

describe("/auth routes", () => {
  it("POST /auth/login returns access + sets refresh cookie", async () => {
    await seedAdmin();
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe("admin@sms-ip.local");
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toMatch(/^refresh=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\/auth/i);
  });

  it("POST /auth/login returns 401 on bad password", async () => {
    await seedAdmin();
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("POST /auth/login returns 400 on validation error", async () => {
    const app = await buildApp();
    const res = await request(app).post("/auth/login").send({ email: "not-email" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("POST /auth/refresh rotates the cookie and returns new access", async () => {
    await seedAdmin();
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const res = await agent.post("/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^refresh=/);
  });

  it("reusing a stale refresh cookie returns 401", async () => {
    await seedAdmin();
    const app = await buildApp();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const stale = login.headers["set-cookie"];
    await request(app).post("/auth/refresh").set("Cookie", stale);
    const reuse = await request(app).post("/auth/refresh").set("Cookie", stale);
    expect(reuse.status).toBe(401);
  });

  it("GET /auth/me requires bearer", async () => {
    const app = await buildApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /auth/me returns user with bearer", async () => {
    await seedAdmin();
    const app = await buildApp();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@sms-ip.local");
  });

  it("POST /auth/logout returns 204 and revokes the family", async () => {
    await seedAdmin();
    const app = await buildApp();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const cookie = login.headers["set-cookie"];
    const out = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);
    const reuse = await request(app).post("/auth/refresh").set("Cookie", cookie);
    expect(reuse.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run tests** (still need health route + module — Task 11 — for `createApp` to import; do Task 11 first then return here.)

> **Ordering note:** This task imports `healthRouter` from a file Task 11 creates. Either skip ahead to Task 11 first, or stub `healthRouter` as `const healthRouter = Router();` inline and replace in Task 11. The recommended sequence is: implement Task 11 next, then run Task 10's tests.

- [ ] **Step 7: Commit**

```bash
git add Backend/src/middleware/rateLimit.ts Backend/src/modules/auth/auth.controller.ts Backend/src/modules/auth/auth.routes.ts Backend/src/modules/auth/auth.routes.test.ts Backend/src/app.ts
git commit -m "feat(backend): /auth routes + controller + app composition"
```

---

## Task 11: Health route

**Files:**
- Create: `Backend/src/modules/health/health.routes.ts`
- Create: `Backend/src/modules/health/health.routes.test.ts`

- [ ] **Step 1: Create `Backend/src/modules/health/health.routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { registry } from "../../openapi/registry.js";

export const healthRouter = Router();

const HealthResponse = z.object({ status: z.literal("ok") }).openapi("HealthResponse");

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["health"],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: HealthResponse } } },
  },
});

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});
```

- [ ] **Step 2: Write the failing health test**

Create `Backend/src/modules/health/health.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

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

describe("/health", () => {
  it("returns 200 { status: ok }", async () => {
    const { createApp } = await import("../../app.js");
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("/openapi.json exposes the spec", async () => {
    const { createApp } = await import("../../app.js");
    const app = createApp();
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe("EMS API");
    expect(res.body.paths["/auth/login"]).toBeDefined();
    expect(res.body.paths["/health"]).toBeDefined();
  });
});
```

- [ ] **Step 3: Run all tests so far**

```bash
cd Backend && pnpm test
```

Expected: PASS — every test from Tasks 1–11.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/modules/health/
git commit -m "feat(backend): /health route + openapi.json sanity test"
```

---

## Task 12: Socket.io scaffolding

**Files:**
- Create: `Backend/src/realtime/index.ts`
- Create: `Backend/src/realtime/chat.namespace.ts`
- Create: `Backend/src/realtime/calls.namespace.ts`
- Create: `Backend/src/realtime/index.test.ts`

- [ ] **Step 1: Create `Backend/src/realtime/chat.namespace.ts`**

```ts
import type { Namespace } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";

export function attachChatNamespace(ns: Namespace): void {
  ns.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as { userId: string }).userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  ns.on("connection", (socket) => {
    const userId = (socket.data as { userId: string }).userId;
    logger.info({ namespace: "/chat", socketId: socket.id, userId }, "socket connected");
  });
}
```

- [ ] **Step 2: Create `Backend/src/realtime/calls.namespace.ts`**

```ts
import type { Namespace } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";

export function attachCallsNamespace(ns: Namespace): void {
  ns.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as { userId: string }).userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  ns.on("connection", (socket) => {
    const userId = (socket.data as { userId: string }).userId;
    logger.info({ namespace: "/calls", socketId: socket.id, userId }, "socket connected");
  });
}
```

- [ ] **Step 3: Create `Backend/src/realtime/index.ts`**

```ts
import { Server as IOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { config } from "../config/index.js";
import { attachChatNamespace } from "./chat.namespace.js";
import { attachCallsNamespace } from "./calls.namespace.js";

export function attachSocketServer(http: HttpServer): IOServer {
  const io = new IOServer(http, {
    cors: { origin: config.FRONTEND_ORIGIN, credentials: true },
  });
  attachChatNamespace(io.of("/chat"));
  attachCallsNamespace(io.of("/calls"));
  return io;
}
```

- [ ] **Step 4: Write the failing realtime tests**

Create `Backend/src/realtime/index.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { io as ioClient } from "socket.io-client";
import type { AddressInfo } from "node:net";

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

let http: HttpServer;
let port: number;

beforeAll(async () => {
  const { attachSocketServer } = await import("./index.js");
  http = createServer();
  attachSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  port = (http.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => http.close(() => resolve()));
});

describe("socket.io namespaces", () => {
  it("rejects /chat connection without token", async () => {
    const socket = ioClient(`http://localhost:${port}/chat`, { reconnection: false, transports: ["websocket"] });
    const err = await new Promise<Error>((resolve) => socket.on("connect_error", resolve));
    expect(err.message).toBe("unauthorized");
    socket.close();
  });

  it("accepts /chat connection with valid token", async () => {
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "ADMIN" });
    const socket = ioClient(`http://localhost:${port}/chat`, {
      reconnection: false,
      transports: ["websocket"],
      auth: { token },
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", (err) => reject(err));
    });
    expect(socket.connected).toBe(true);
    socket.close();
  });
});
```

Add `socket.io-client` to devDependencies:

```bash
cd Backend && pnpm add -D socket.io-client
```

- [ ] **Step 5: Run tests**

```bash
cd Backend && pnpm test src/realtime/index.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/realtime/ Backend/package.json Backend/pnpm-lock.yaml
git commit -m "feat(backend): socket.io namespace stubs with JWT auth"
```

---

## Task 13: Server bootstrap + seed script

**Files:**
- Create: `Backend/src/server.ts`
- Create: `Backend/src/seed.ts`

- [ ] **Step 1: Create `Backend/src/server.ts`**

```ts
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDb } from "./db/index.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { attachSocketServer } from "./realtime/index.js";

async function main() {
  await connectDb();
  const app = createApp();
  const http = createServer(app);
  attachSocketServer(http);
  http.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, `EMS backend listening`);
    logger.info(`Swagger: http://localhost:${config.PORT}/docs`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
```

- [ ] **Step 2: Create `Backend/src/seed.ts`**

```ts
import bcrypt from "bcrypt";
import { connectDb, disconnectDb } from "./db/index.js";
import { User } from "./models/user.model.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";

async function main() {
  await connectDb();
  const existing = await User.findOne({ email: config.SEED_ADMIN_EMAIL });
  if (existing) {
    logger.info({ email: config.SEED_ADMIN_EMAIL }, "admin already exists; skipping");
  } else {
    const passwordHash = await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 12);
    await User.create({
      email: config.SEED_ADMIN_EMAIL,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      isVerified: true,
    });
    logger.info({ email: config.SEED_ADMIN_EMAIL }, "admin created");
  }
  await disconnectDb();
}

main().catch((err) => {
  logger.fatal({ err }, "seed failed");
  process.exit(1);
});
```

- [ ] **Step 3: Manual smoke (requires Mongo running locally)**

```bash
# Terminal 1: ensure Mongo is reachable at MONGO_URI
docker run --rm -d --name ems-mongo -p 27017:27017 mongo:7
cd Backend
pnpm seed
pnpm dev
# In another terminal:
curl -s http://localhost:3000/health
# → {"status":"ok"}
curl -s -i -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@sms-ip.local","password":"ChangeMe-Admin-1!"}'
# → 200 with accessToken + Set-Cookie: refresh=...
open http://localhost:3000/docs   # macOS — opens swagger UI
```

Expected:
- `/health` returns `{"status":"ok"}`.
- `/auth/login` with seeded creds returns 200 + Set-Cookie.
- `/docs` shows Swagger UI listing `/auth/*` and `/health`.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/server.ts Backend/src/seed.ts
git commit -m "feat(backend): server bootstrap + seed script"
```

---

## Task 14: Final test sweep

- [ ] **Step 1: Run full test suite**

```bash
cd Backend && pnpm test
```

Expected: every test from Tasks 1, 2, 3, 4, 5, 6, 9, 10, 11, 12 passes. Roughly 30+ tests.

- [ ] **Step 2: Type-check**

```bash
cd Backend && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
cd Backend && pnpm build
```

Expected: `Backend/dist/server.js` produced, no errors.

- [ ] **Step 4: Commit nothing (verification only); tag the milestone**

```bash
git tag foundation-backend-done
```

---

## Definition of Done (Backend Foundation)

- `pnpm install` cleanly resolves all dependencies.
- `pnpm test` passes ~30+ tests.
- `pnpm exec tsc --noEmit` reports zero errors.
- `pnpm build` produces `dist/server.js`.
- With Mongo reachable: `pnpm seed && pnpm dev` then:
  - `curl :3000/health` → `{"status":"ok"}`.
  - `curl -X POST :3000/auth/login` with seeded creds → 200 + access token + Set-Cookie refresh.
  - `:3000/docs` renders Swagger UI showing `/auth/*` and `/health`.
- The git tag `foundation-backend-done` exists.

After this plan completes, hand off to `2026-04-25-foundation-frontend.md`.
