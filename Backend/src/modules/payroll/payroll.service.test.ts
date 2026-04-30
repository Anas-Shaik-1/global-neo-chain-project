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
  const { Payslip } = await import("../../models/payslip.model.js");
  await Payslip.init();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function makeUser(email: string, role: "EMPLOYEE" | "HR" | "ADMIN" = "EMPLOYEE") {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
  });
}

describe("payroll.service", () => {
  it("createPayslip computes netAmount correctly (gross + earnings - deductions)", async () => {
    const { createPayslip } = await import("./payroll.service.js");
    const employee = await makeUser("e@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    const out = await createPayslip(
      {
        userId: employee._id.toString(),
        month: "2026-04",
        gross: 10000,
        breakdown: [
          { label: "Bonus", amount: 500, kind: "EARNING" },
          { label: "Tax", amount: 1500, kind: "DEDUCTION" },
        ],
      },
      hr._id.toString(),
    );
    expect(out.gross).toBe(10000);
    expect(out.netAmount).toBe(9000);
    // Default currency is INR after the currency enum tightening.
    expect(out.currency).toBe("INR");
    expect(out.userId).toBe(employee._id.toString());
    expect(out.userName).toBe("e@b.com");
    expect(out.generatedById).toBe(hr._id.toString());
    expect(out.generatedByName).toBe("hr@b.com");
    expect(out.breakdown).toHaveLength(2);
  });

  it("createPayslip duplicate month for same user throws ConflictError 409", async () => {
    const { createPayslip } = await import("./payroll.service.js");
    const employee = await makeUser("e@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    await createPayslip(
      {
        userId: employee._id.toString(),
        month: "2026-04",
        gross: 5000,
      },
      hr._id.toString(),
    );
    await expect(
      createPayslip(
        {
          userId: employee._id.toString(),
          month: "2026-04",
          gross: 7000,
        },
        hr._id.toString(),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("getPayslip by another employee throws ForbiddenError 403", async () => {
    const { createPayslip, getPayslip } = await import("./payroll.service.js");
    const owner = await makeUser("owner@b.com");
    const other = await makeUser("other@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    const created = await createPayslip(
      {
        userId: owner._id.toString(),
        month: "2026-03",
        gross: 5000,
      },
      hr._id.toString(),
    );
    await expect(
      getPayslip(created.id, { id: other._id.toString(), role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("getPayslip by HR succeeds", async () => {
    const { createPayslip, getPayslip } = await import("./payroll.service.js");
    const owner = await makeUser("owner@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    const created = await createPayslip(
      {
        userId: owner._id.toString(),
        month: "2026-03",
        gross: 5000,
      },
      hr._id.toString(),
    );
    const got = await getPayslip(created.id, {
      id: hr._id.toString(),
      role: "HR",
    });
    expect(got.id).toBe(created.id);
    expect(got.userName).toBe("owner@b.com");
  });

  it("listMyPayslips filters by month", async () => {
    const { createPayslip, listMyPayslips } = await import("./payroll.service.js");
    const owner = await makeUser("owner@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    await createPayslip(
      { userId: owner._id.toString(), month: "2026-02", gross: 4000 },
      hr._id.toString(),
    );
    await createPayslip(
      { userId: owner._id.toString(), month: "2026-03", gross: 5000 },
      hr._id.toString(),
    );
    const filtered = await listMyPayslips(owner._id.toString(), {
      month: "2026-03",
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]!.month).toBe("2026-03");

    const all = await listMyPayslips(owner._id.toString(), {});
    expect(all.total).toBe(2);
  });
});
