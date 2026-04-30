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
  const { User } = await import("../../models/user.model.js");
  await User.init();
  const { CallSession } = await import("../../models/callSession.model.js");
  await CallSession.init();
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

async function seedAndToken(email: string) {
  const { User } = await import("../../models/user.model.js");
  const u = await User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role: "EMPLOYEE",
  });
  const { signAccessToken } = await import("../../lib/tokens.js");
  return {
    id: u._id.toString(),
    token: signAccessToken({ sub: u._id.toString(), role: "EMPLOYEE", isProjectManager: false }),
  };
}

describe("/calls", () => {
  it("POST /calls creates a DIRECT call session (201)", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/calls")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ peerIds: [b.id] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe("INVITED");
    expect(res.body.kind).toBe("DIRECT");
    expect(res.body.initiatorId).toBe(a.id);
    expect(res.body.participants).toHaveLength(2);
    expect(res.body.caller.id).toBe(a.id);
    expect(res.body.callee.id).toBe(b.id);
  });

  it("GET /calls/me returns history including incoming and outgoing", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const c = await seedAndToken("c@b.com");
    const app = await buildApp();

    await request(app)
      .post("/calls")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ peerIds: [b.id] });
    await new Promise((r) => setTimeout(r, 5));
    await request(app)
      .post("/calls")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ peerIds: [a.id] });

    const res = await request(app)
      .get("/calls/me")
      .set("Authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    // newest first
    expect(res.body[0].initiatorId).toBe(c.id);
    expect(
      res.body[0].participants.some(
        (p: { id: string }) => p.id === a.id,
      ),
    ).toBe(true);
  });

  it("POST /calls/:id/end sets endedAt and updates status", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/calls")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ peerIds: [b.id] });
    expect(created.status).toBe(201);
    const res = await request(app)
      .post(`/calls/${created.body.id}/end`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.endedAt).toBeTruthy();
    expect(res.body.endReason).toBe("HANGUP");
  });
});
