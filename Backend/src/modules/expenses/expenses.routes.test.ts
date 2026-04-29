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
  const { Expense } = await import("../../models/expense.model.js");
  await Expense.init();
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
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
  });
  const { signAccessToken } = await import("../../lib/tokens.js");
  return {
    id: u._id.toString(),
    token: signAccessToken({ sub: u._id.toString(), role, isProjectManager: false }),
  };
}

const samplePayload = {
  amount: 1234,
  category: "MEALS",
  description: "Client dinner",
  incurredOn: "2026-04-20T19:00:00Z",
};

describe("/expenses", () => {
  it("POST /expenses by EMPLOYEE returns 201 with PENDING status", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${e.token}`)
      .send(samplePayload);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.userId).toBe(e.id);
    expect(res.body.amount).toBe(1234);
    expect(res.body.category).toBe("MEALS");
  });

  it("GET /expenses by EMPLOYEE returns 403", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .get("/expenses")
      .set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(403);
  });

  it("GET /expenses by HR returns 200 with paginated items", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();
    await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${e.token}`)
      .send(samplePayload);
    const res = await request(app)
      .get("/expenses")
      .set("Authorization", `Bearer ${hr.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total).toBe(1);
  });

  it("POST /expenses/:id/decide by EMPLOYEE returns 403", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${e.token}`)
      .send(samplePayload);
    const res = await request(app)
      .post(`/expenses/${created.body.id}/decide`)
      .set("Authorization", `Bearer ${e.token}`)
      .send({ decision: "APPROVED" });
    expect(res.status).toBe(403);
  });

  it("POST /expenses/:id/decide by HR returns 200 and updates status", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const hr = await seedAndToken("HR", "hr@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${e.token}`)
      .send(samplePayload);
    const res = await request(app)
      .post(`/expenses/${created.body.id}/decide`)
      .set("Authorization", `Bearer ${hr.token}`)
      .send({ decision: "APPROVED", note: "ok" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.decisionById).toBe(hr.id);
    expect(res.body.decisionNote).toBe("ok");
    expect(res.body.decidedAt).toBeTruthy();
  });

  it("POST /expenses/:id/receipt accepts PDF and persists receiptUrl", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const created = await request(app)
      .post("/expenses")
      .set("Authorization", `Bearer ${e.token}`)
      .send(samplePayload);
    const res = await request(app)
      .post(`/expenses/${created.body.id}/receipt`)
      .set("Authorization", `Bearer ${e.token}`)
      .attach("file", Buffer.from("%PDF-1.4 fake"), {
        filename: "receipt.pdf",
        contentType: "application/pdf",
      });
    expect(res.status).toBe(200);
    expect(res.body.receiptUrl).toBeTruthy();
    expect(typeof res.body.receiptUrl).toBe("string");
  });
});
