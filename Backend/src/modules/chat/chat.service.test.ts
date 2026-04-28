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
  const { Conversation } = await import("../../models/conversation.model.js");
  await Conversation.init();
  const { Message } = await import("../../models/message.model.js");
  await Message.init();
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

describe("chat.service", () => {
  it("openConversation creates a new conversation between two users", async () => {
    const { openConversation } = await import("./chat.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const out = await openConversation(a._id.toString(), b._id.toString());
    expect(out.id).toBeTruthy();
    expect(out.participants).toHaveLength(2);
    const ids = out.participants.map((p) => p.id).sort();
    expect(ids).toEqual([a._id.toString(), b._id.toString()].sort());
    expect(out.lastMessageAt).toBeNull();
    expect(out.unreadCount).toBe(0);
  });

  it("openConversation returns the same conversation for the same pair", async () => {
    const { openConversation } = await import("./chat.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const c1 = await openConversation(a._id.toString(), b._id.toString());
    const c2 = await openConversation(b._id.toString(), a._id.toString());
    expect(c1.id).toBe(c2.id);
  });

  it("openConversation rejects opening a DM with yourself", async () => {
    const { openConversation } = await import("./chat.service.js");
    const a = await makeUser("a@b.com");
    await expect(
      openConversation(a._id.toString(), a._id.toString()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("sendMessage by non-participant throws ForbiddenError", async () => {
    const { openConversation, sendMessage } = await import("./chat.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const c = await makeUser("c@b.com");
    const convo = await openConversation(a._id.toString(), b._id.toString());
    await expect(
      sendMessage(convo.id, c._id.toString(), "hi"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("sendMessage updates conversation lastMessageAt and preview", async () => {
    const { openConversation, sendMessage, listConversations } = await import(
      "./chat.service.js"
    );
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const convo = await openConversation(a._id.toString(), b._id.toString());
    const before = Date.now();
    await sendMessage(convo.id, a._id.toString(), "hello world");
    const list = await listConversations(a._id.toString());
    expect(list).toHaveLength(1);
    const first = list[0]!;
    expect(first.lastMessagePreview).toBe("hello world");
    expect(first.lastMessageAt).toBeTruthy();
    expect(new Date(first.lastMessageAt!).getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("listMessages returns paginated newest-first messages for a participant", async () => {
    const { openConversation, sendMessage, listMessages } = await import(
      "./chat.service.js"
    );
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const convo = await openConversation(a._id.toString(), b._id.toString());
    await sendMessage(convo.id, a._id.toString(), "first");
    await sendMessage(convo.id, b._id.toString(), "second");
    await sendMessage(convo.id, a._id.toString(), "third");
    const out = await listMessages(convo.id, a._id.toString(), { limit: 50 });
    expect(out).toHaveLength(3);
    expect(out[0]!.body).toBe("third");
    expect(out[2]!.body).toBe("first");
  });
});
