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
  // Build indexes for Department uniqueness checks
  const { Department } = await import("../../models/department.model.js");
  await Department.init();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe("departments.service", () => {
  it("create returns dept with employeeCount=0", async () => {
    const { createDepartment } = await import("./departments.service.js");
    const d = await createDepartment({ name: "Eng", code: "eng" });
    expect(d.code).toBe("eng");
    expect(d.employeeCount).toBe(0);
  });

  it("create rejects duplicate name", async () => {
    const { createDepartment } = await import("./departments.service.js");
    await createDepartment({ name: "HR", code: "hr" });
    await expect(createDepartment({ name: "HR", code: "hr2" })).rejects.toThrow();
  });

  it("listDepartments returns paginated items with employeeCount", async () => {
    const { User } = await import("../../models/user.model.js");
    const { createDepartment, listDepartments } = await import("./departments.service.js");
    const d1 = await createDepartment({ name: "Eng", code: "eng" });
    await User.create({
      email: "x@b.com",
      passwordHash: await bcrypt.hash("pw", 4),
      name: "X",
      role: "EMPLOYEE",
      departmentId: new Types.ObjectId(d1.id),
    });
    const list = await listDepartments({ page: 1, limit: 20 });
    expect(list.items.length).toBe(1);
    expect(list.items[0]!.employeeCount).toBe(1);
  });

  it("deleteDepartment refuses when employees still reference it", async () => {
    const { User } = await import("../../models/user.model.js");
    const { createDepartment, deleteDepartment } = await import("./departments.service.js");
    const d = await createDepartment({ name: "Eng", code: "eng" });
    await User.create({
      email: "y@b.com",
      passwordHash: await bcrypt.hash("pw", 4),
      name: "Y",
      role: "EMPLOYEE",
      departmentId: new Types.ObjectId(d.id),
    });
    await expect(deleteDepartment(d.id)).rejects.toThrow();
  });

  it("deleteDepartment succeeds when no employees reference it", async () => {
    const { Department } = await import("../../models/department.model.js");
    const { createDepartment, deleteDepartment } = await import("./departments.service.js");
    const d = await createDepartment({ name: "Eng", code: "eng" });
    await deleteDepartment(d.id);
    const found = await Department.findById(d.id);
    expect(found).toBeNull();
  });
});
