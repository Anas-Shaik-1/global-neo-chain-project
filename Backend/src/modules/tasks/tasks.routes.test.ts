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
  const { Project } = await import("../../models/project.model.js");
  await Project.init();
  const { Task } = await import("../../models/task.model.js");
  await Task.init();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

async function seedAndToken(role: "ADMIN" | "HR" | "EMPLOYEE" | "PM", email: string) {
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
    token: signAccessToken({ sub: u._id.toString(), role }),
  };
}

describe("/projects + /tasks", () => {
  it("GET /projects by EMPLOYEE returns 200", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app).get("/projects").set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("POST /projects by EMPLOYEE returns 403", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${e.token}`)
      .send({ name: "Atlas", key: "atlas" });
    expect(res.status).toBe(403);
  });

  it("POST /projects by PM returns 201", async () => {
    const pm = await seedAndToken("PM", "pm@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ name: "Atlas", key: "atlas" });
    expect(res.status).toBe(201);
    expect(res.body.key).toBe("atlas");
  });

  it("POST /tasks by any authed user returns 201", async () => {
    const pm = await seedAndToken("PM", "pm@b.com");
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const proj = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ name: "Atlas", key: "atlas" });
    const res = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${e.token}`)
      .send({ projectId: proj.body.id, title: "Implement login" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Implement login");
    expect(res.body.createdById).toBe(e.id);
    expect(res.body.status).toBe("TODO");
  });

  it("PATCH /tasks/:id changes status", async () => {
    const pm = await seedAndToken("PM", "pm@b.com");
    const app = await buildApp();
    const proj = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ name: "Atlas", key: "atlas" });
    const created = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Do X" });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("POST /tasks/:id/comments returns comment with authorName", async () => {
    const pm = await seedAndToken("PM", "pm@b.com");
    const app = await buildApp();
    const proj = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ name: "Atlas", key: "atlas" });
    const created = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Do X" });
    const res = await request(app)
      .post(`/tasks/${created.body.id}/comments`)
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ body: "looks good" });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe("looks good");
    expect(res.body.authorName).toBe("pm@b.com");
  });

  it("GET /tasks/:id/activity returns 200 with at least the CREATED entry", async () => {
    const pm = await seedAndToken("PM", "pm@b.com");
    const app = await buildApp();
    const proj = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ name: "Atlas", key: "atlas" });
    const created = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Track me" });
    const res = await request(app)
      .get(`/tasks/${created.body.id}/activity`)
      .set("Authorization", `Bearer ${pm.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((a: { kind: string }) => a.kind === "CREATED")).toBe(true);
  });

  it("GET /tasks/:id/subtasks returns sub-tasks only", async () => {
    const pm = await seedAndToken("PM", "pm@b.com");
    const app = await buildApp();
    const proj = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ name: "Atlas", key: "atlas" });
    const parent = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Parent" });
    await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Sub A", parentTaskId: parent.body.id });
    await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Sub B", parentTaskId: parent.body.id });
    // Unrelated top-level task
    await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${pm.token}`)
      .send({ projectId: proj.body.id, title: "Other" });
    const res = await request(app)
      .get(`/tasks/${parent.body.id}/subtasks`)
      .set("Authorization", `Bearer ${pm.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    const titles = res.body.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(["Sub A", "Sub B"]);
  });
});
