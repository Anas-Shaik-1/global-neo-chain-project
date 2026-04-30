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

async function makeUser(email: string) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role: "EMPLOYEE",
  });
}

describe("notifications.service", () => {
  it("notify creates an entry with readAt=null", async () => {
    const { notify, getUnreadCount } = await import("./notifications.service.js");
    const u = await makeUser("a@b.com");
    const created = await notify(u._id.toString(), {
      kind: "TASK_ASSIGNED",
      title: "New task",
      body: "Body",
      link: "/tasks",
    });
    expect(created.readAt).toBeNull();
    expect(created.kind).toBe("TASK_ASSIGNED");
    const count = await getUnreadCount(u._id.toString());
    expect(count).toBe(1);
  });

  it("listMine returns notifications sorted newest-first", async () => {
    const { notify, listMine } = await import("./notifications.service.js");
    const u = await makeUser("b@b.com");
    const first = await notify(u._id.toString(), { kind: "TASK_ASSIGNED", title: "first" });
    // Wait a tick so the createdAt timestamps differ.
    await new Promise((r) => setTimeout(r, 10));
    const second = await notify(u._id.toString(), { kind: "TASK_ASSIGNED", title: "second" });
    const list = await listMine(u._id.toString(), {});
    expect(list.length).toBe(2);
    expect(list[0]!.id).toBe(second.id);
    expect(list[1]!.id).toBe(first.id);
  });

  it("markAllRead sets readAt on every unread entry for the user", async () => {
    const { notify, markAllRead, getUnreadCount } = await import("./notifications.service.js");
    const u = await makeUser("c@b.com");
    await notify(u._id.toString(), { kind: "TASK_ASSIGNED", title: "x" });
    await notify(u._id.toString(), { kind: "TASK_ASSIGNED", title: "y" });
    expect(await getUnreadCount(u._id.toString())).toBe(2);
    const res = await markAllRead(u._id.toString());
    expect(res.count).toBe(2);
    expect(await getUnreadCount(u._id.toString())).toBe(0);
  });
});
