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
  const { Notification } = await import("../../models/notification.model.js");
  await Notification.init();
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

describe("/notifications", () => {
  it("GET /notifications/me returns 200 with my notifications", async () => {
    const me = await seedAndToken("EMPLOYEE", "me@b.com");
    const { notify } = await import("./notifications.service.js");
    await notify(me.id, { kind: "TASK_ASSIGNED", title: "Hi", link: "/tasks" });
    const app = await buildApp();
    const res = await request(app)
      .get("/notifications/me")
      .set("Authorization", `Bearer ${me.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title).toBe("Hi");
  });

  it("POST /notifications/me/:id/read returns 204 and sets readAt", async () => {
    const me = await seedAndToken("EMPLOYEE", "me@b.com");
    const { notify } = await import("./notifications.service.js");
    const created = await notify(me.id, { kind: "TASK_ASSIGNED", title: "Hi" });
    const app = await buildApp();
    const res = await request(app)
      .post(`/notifications/me/${created.id}/read`)
      .set("Authorization", `Bearer ${me.token}`);
    expect(res.status).toBe(204);
    const { Notification } = await import("../../models/notification.model.js");
    const refreshed = await Notification.findById(created.id);
    expect(refreshed?.readAt).toBeTruthy();
  });

  it("GET /notifications/me/unread-count returns the right number", async () => {
    const me = await seedAndToken("EMPLOYEE", "me@b.com");
    const { notify } = await import("./notifications.service.js");
    await notify(me.id, { kind: "TASK_ASSIGNED", title: "1" });
    await notify(me.id, { kind: "TASK_ASSIGNED", title: "2" });
    await notify(me.id, { kind: "TASK_ASSIGNED", title: "3" });
    const app = await buildApp();
    const res = await request(app)
      .get("/notifications/me/unread-count")
      .set("Authorization", `Bearer ${me.token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });
});
