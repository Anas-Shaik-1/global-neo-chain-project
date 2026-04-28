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
  // Ensure indexes built (Department uniqueness)
  const { Department } = await import("../../models/department.model.js");
  await Department.init();
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
