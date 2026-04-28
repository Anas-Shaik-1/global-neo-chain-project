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
  // Build indexes
  const { User } = await import("../../models/user.model.js");
  await User.init();
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
