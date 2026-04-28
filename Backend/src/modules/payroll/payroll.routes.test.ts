import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

let tmpRoot = "";

beforeAll(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ems-payroll-"));
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
    UPLOADS_DIR: tmpRoot,
    PUBLIC_BASE_URL: "http://test",
  });
  await startTestDb();
  const { User } = await import("../../models/user.model.js");
  await User.init();
  const { Payslip } = await import("../../models/payslip.model.js");
  await Payslip.init();
});
afterAll(async () => {
  await stopTestDb();
  rmSync(tmpRoot, { recursive: true, force: true });
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
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
    jobTitle: "Engineer",
  });
  const { signAccessToken } = await import("../../lib/tokens.js");
  return {
    id: u._id.toString(),
    token: signAccessToken({ sub: u._id.toString(), role }),
  };
}

describe("/payroll", () => {
  it("POST /payroll by EMPLOYEE returns 403", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/payroll")
      .set("Authorization", `Bearer ${e.token}`)
      .send({
        userId: e.id,
        month: "2026-04",
        gross: 10000,
      });
    expect(res.status).toBe(403);
  });

  it("POST /payroll by HR returns 201 with computed netAmount", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/payroll")
      .set("Authorization", `Bearer ${hr.token}`)
      .send({
        userId: e.id,
        month: "2026-04",
        gross: 10000,
        breakdown: [
          { label: "Bonus", amount: 500, kind: "EARNING" },
          { label: "Tax", amount: 1500, kind: "DEDUCTION" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.gross).toBe(10000);
    expect(res.body.netAmount).toBe(9000);
    expect(res.body.userId).toBe(e.id);
    expect(res.body.generatedById).toBe(hr.id);
  });

  it("GET /payroll/me returns 200 with paginated items", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();
    await request(app)
      .post("/payroll")
      .set("Authorization", `Bearer ${hr.token}`)
      .send({ userId: e.id, month: "2026-04", gross: 5000 });
    const res = await request(app)
      .get("/payroll/me")
      .set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total).toBe(1);
  });

  it("GET /payroll/:id/pdf returns application/pdf with PDF magic bytes", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/payroll")
      .set("Authorization", `Bearer ${hr.token}`)
      .send({ userId: e.id, month: "2026-04", gross: 5000 });
    expect(created.status).toBe(201);
    const res = await request(app)
      .get(`/payroll/${created.body.id}/pdf`)
      .set("Authorization", `Bearer ${e.token}`)
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on("data", (c: Buffer) => chunks.push(c));
        response.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    const body = res.body as Buffer;
    expect(body.slice(0, 5).toString()).toBe("%PDF-");
  });
});
