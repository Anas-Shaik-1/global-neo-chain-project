import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
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
  const { Project } = await import("../../models/project.model.js");
  await Project.init();
  const { Task } = await import("../../models/task.model.js");
  await Task.init();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function makeUser(email: string) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role: "EMPLOYEE",
  });
}

describe("tasks.service", () => {
  it("createProject returns project with taskCount=0", async () => {
    const { createProject } = await import("./tasks.service.js");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    expect(p.key).toBe("atlas");
    expect(p.taskCount).toBe(0);
  });

  it("createProject rejects duplicate key with ConflictError 409", async () => {
    const { createProject } = await import("./tasks.service.js");
    await createProject({ name: "Atlas", key: "atlas" });
    await expect(createProject({ name: "Atlas Two", key: "atlas" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("createTask validates project exists", async () => {
    const { createTask } = await import("./tasks.service.js");
    const u = await makeUser("u@b.com");
    const fakeProjectId = new Types.ObjectId().toString();
    await expect(
      createTask({ projectId: fakeProjectId, title: "x" }, u._id.toString()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("listTasks filters by status", async () => {
    const { createProject, createTask, listTasks, updateTask } = await import("./tasks.service.js");
    const u = await makeUser("u@b.com");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    const t1 = await createTask({ projectId: p.id, title: "One" }, u._id.toString());
    await createTask({ projectId: p.id, title: "Two" }, u._id.toString());
    await updateTask(t1.id, { status: "DONE" });
    const todo = await listTasks(p.id, { status: "TODO" });
    expect(todo.length).toBe(1);
    expect(todo[0]!.title).toBe("Two");
    const done = await listTasks(p.id, { status: "DONE" });
    expect(done.length).toBe(1);
    expect(done[0]!.title).toBe("One");
  });

  it("addComment denormalizes authorName", async () => {
    const { createProject, createTask, addComment } = await import("./tasks.service.js");
    const u = await makeUser("alice@b.com");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    const t = await createTask({ projectId: p.id, title: "x" }, u._id.toString());
    const c = await addComment(t.id, u._id.toString(), "Hello world");
    expect(c.body).toBe("Hello world");
    expect(c.authorName).toBe("alice@b.com");
    expect(c.authorId).toBe(u._id.toString());
  });

  it("createTask with parentTaskId creates a subtask", async () => {
    const { createProject, createTask } = await import("./tasks.service.js");
    const u = await makeUser("u@b.com");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    const parent = await createTask({ projectId: p.id, title: "Parent" }, u._id.toString());
    const child = await createTask(
      { projectId: p.id, title: "Child", parentTaskId: parent.id },
      u._id.toString(),
    );
    expect(child.parentTaskId).toBe(parent.id);
  });

  it("updateTask logs STATUS_CHANGED activity", async () => {
    const { createProject, createTask, updateTask, listActivity } = await import("./tasks.service.js");
    const u = await makeUser("u@b.com");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    const t = await createTask({ projectId: p.id, title: "Task" }, u._id.toString());
    await updateTask(t.id, { status: "IN_PROGRESS" }, u._id.toString());
    const activity = await listActivity(t.id);
    const status = activity.find((a) => a.kind === "STATUS_CHANGED");
    expect(status).toBeDefined();
    expect(status!.fromValue).toBe("TODO");
    expect(status!.toValue).toBe("IN_PROGRESS");
  });

  it("addComment logs COMMENTED activity", async () => {
    const { createProject, createTask, addComment, listActivity } = await import("./tasks.service.js");
    const u = await makeUser("u@b.com");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    const t = await createTask({ projectId: p.id, title: "Task" }, u._id.toString());
    await addComment(t.id, u._id.toString(), "Hi there");
    const activity = await listActivity(t.id);
    const commented = activity.find((a) => a.kind === "COMMENTED");
    expect(commented).toBeDefined();
    expect(commented!.summary).toBe("Hi there");
  });

  it("listSubtasks returns only direct children", async () => {
    const { createProject, createTask, listSubtasks } = await import("./tasks.service.js");
    const u = await makeUser("u@b.com");
    const p = await createProject({ name: "Atlas", key: "atlas" });
    const parent = await createTask({ projectId: p.id, title: "Parent" }, u._id.toString());
    const sub1 = await createTask(
      { projectId: p.id, title: "S1", parentTaskId: parent.id },
      u._id.toString(),
    );
    const sub2 = await createTask(
      { projectId: p.id, title: "S2", parentTaskId: parent.id },
      u._id.toString(),
    );
    // unrelated other top-level task
    await createTask({ projectId: p.id, title: "Other" }, u._id.toString());
    const subs = await listSubtasks(parent.id);
    expect(subs.length).toBe(2);
    const ids = subs.map((s) => s.id).sort();
    expect(ids).toEqual([sub1.id, sub2.id].sort());
  });
});
