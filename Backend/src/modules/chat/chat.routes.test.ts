import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

let tmpUploads = "";

beforeAll(async () => {
  tmpUploads = mkdtempSync(join(tmpdir(), "ems-chat-routes-"));
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
    UPLOADS_DIR: tmpUploads,
    PUBLIC_BASE_URL: "http://test",
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
  if (tmpUploads) rmSync(tmpUploads, { recursive: true, force: true });
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

describe("/chat", () => {
  it("POST /chat/conversations creates a conversation between two users", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: b.id });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(Array.isArray(res.body.participants)).toBe(true);
    expect(res.body.participants).toHaveLength(2);
    expect(res.body.unreadCount).toBe(0);
  });

  it("POST /chat/conversations again with same other user returns same conversation", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const r1 = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: b.id });
    const r2 = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${b.token}`)
      .send({ otherUserId: a.id });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.id).toBe(r2.body.id);
  });

  it("POST /chat/conversations/:id/messages returns 201 and creates a message", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const convo = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: b.id });
    const res = await request(app)
      .post(`/chat/conversations/${convo.body.id}/messages`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ body: "hello b" });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe("hello b");
    expect(res.body.conversationId).toBe(convo.body.id);
    expect(res.body.authorId).toBe(a.id);
  });

  it("GET /chat/conversations/:id/messages returns messages newest-first", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const convo = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: b.id });
    await request(app)
      .post(`/chat/conversations/${convo.body.id}/messages`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ body: "first" });
    await request(app)
      .post(`/chat/conversations/${convo.body.id}/messages`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ body: "second" });
    const res = await request(app)
      .get(`/chat/conversations/${convo.body.id}/messages`)
      .set("Authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].body).toBe("second");
    expect(res.body[1].body).toBe("first");
  });

  it("POST /chat/conversations/:id/messages/attachment with image succeeds 201, message has attachmentUrl", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const app = await buildApp();
    const convo = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: b.id });
    const res = await request(app)
      .post(`/chat/conversations/${convo.body.id}/messages/attachment`)
      .set("Authorization", `Bearer ${a.token}`)
      .attach("file", Buffer.from("PNGDATA"), {
        filename: "screenshot.png",
        contentType: "image/png",
      })
      .field("body", "look at this");
    expect(res.status).toBe(201);
    expect(res.body.body).toBe("look at this");
    expect(typeof res.body.attachmentUrl).toBe("string");
    expect(res.body.attachmentUrl).toMatch(/\/files\/chat\//);
    expect(res.body.attachmentName).toBe("screenshot.png");
    expect(res.body.attachmentMimeType).toBe("image/png");
    expect(res.body.attachmentSize).toBe(Buffer.from("PNGDATA").length);
  });

  it("POST /chat/groups 201 creates a group with all members", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const c = await seedAndToken("c@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/chat/groups")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ name: "Squad", participantIds: [b.id, c.id] });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("GROUP");
    expect(res.body.name).toBe("Squad");
    expect(res.body.createdById).toBe(a.id);
    expect(res.body.participants).toHaveLength(3);
    const ids = res.body.participants.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual([a.id, b.id, c.id].sort());
  });

  it("POST /chat/conversations/:id/members 200 adds a member", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const c = await seedAndToken("c@b.com");
    const app = await buildApp();
    const grp = await request(app)
      .post("/chat/groups")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ name: "Squad", participantIds: [b.id] });
    expect(grp.status).toBe(201);
    const res = await request(app)
      .post(`/chat/conversations/${grp.body.id}/members`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ userId: c.id });
    expect(res.status).toBe(200);
    expect(res.body.participants).toHaveLength(3);
    const ids = res.body.participants.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual([a.id, b.id, c.id].sort());
  });

  it("GET /chat/conversations lists my conversations sorted by lastMessageAt desc", async () => {
    const a = await seedAndToken("a@b.com");
    const b = await seedAndToken("b@b.com");
    const c = await seedAndToken("c@b.com");
    const app = await buildApp();
    const cAB = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: b.id });
    const cAC = await request(app)
      .post("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ otherUserId: c.id });
    // Send a message in cAB so its lastMessageAt is more recent.
    await request(app)
      .post(`/chat/conversations/${cAC.body.id}/messages`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ body: "to c" });
    await new Promise((r) => setTimeout(r, 5));
    await request(app)
      .post(`/chat/conversations/${cAB.body.id}/messages`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ body: "to b" });
    const res = await request(app)
      .get("/chat/conversations")
      .set("Authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(cAB.body.id);
    expect(res.body[1].id).toBe(cAC.body.id);
  });
});
