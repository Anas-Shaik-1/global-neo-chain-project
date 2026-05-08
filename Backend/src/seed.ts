import bcrypt from "bcrypt";
import { connectDb, disconnectDb } from "./db/index.js";
import { User, type Role } from "./models/user.model.js";
import { Conversation } from "./models/conversation.model.js";
import { CallSession } from "./models/callSession.model.js";
import { Department } from "./models/department.model.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";

// Default departments seeded so HR/Admin can place candidates immediately
// without first having to spin up the org chart by hand. New deployments
// almost always need at least Frontend / Backend / Testing.
const DEFAULT_DEPARTMENTS: { name: string; description?: string }[] = [
  { name: "Frontend", description: "Web/UI engineering" },
  { name: "Backend", description: "Services, APIs, infrastructure" },
  { name: "Testing", description: "QA, test automation, bug triage" },
];

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: Role;
  jobTitle: string;
  isProjectManager: boolean;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: config.SEED_ADMIN_EMAIL,
    password: config.SEED_ADMIN_PASSWORD,
    name: "Admin",
    role: "ADMIN",
    jobTitle: "Platform Administrator",
    isProjectManager: false,
  },
  {
    email: "hr@global-neochain.local",
    password: "ChangeMe-HR-1!",
    name: "Hannah Rivera",
    role: "HR",
    jobTitle: "Head of People",
    isProjectManager: false,
  },
  {
    email: "pm@global-neochain.local",
    password: "ChangeMe-PM-1!",
    name: "Priya Mehta",
    // PM is no longer a primary role — it's an Employee with the
    // isProjectManager sub-role flag flipped on by an Admin.
    role: "EMPLOYEE" as Role,
    jobTitle: "Project Manager",
    isProjectManager: true,
  },
  {
    email: "employee@global-neochain.local",
    password: "ChangeMe-Employee-1!",
    name: "Eli Mwangi",
    role: "EMPLOYEE",
    jobTitle: "Software Engineer",
    isProjectManager: false,
  },
];

function slugifyDept(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedDefaultDepartments(): Promise<void> {
  for (const d of DEFAULT_DEPARTMENTS) {
    const code = slugifyDept(d.name);
    const exists = await Department.findOne({ $or: [{ name: d.name }, { code }] }).lean();
    if (exists) {
      logger.info({ name: d.name }, "department already exists; skipping");
      continue;
    }
    await Department.create({
      name: d.name,
      code,
      description: d.description ?? null,
      managerId: null,
    });
    logger.info({ name: d.name, code }, "department created");
  }
}

async function main() {
  await connectDb();

  // Backfill: any pre-existing User docs that lived through Foundation may not
  // have isActive set (the field was added in EM Task 1). Default to active.
  const backfill = await User.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } },
  );
  if (backfill.modifiedCount > 0) {
    logger.info({ count: backfill.modifiedCount }, "backfilled isActive on legacy users");
  }

  // Backfill: every pre-existing User doc must have approvalStatus set, or the
  // 2-stage approval login gate (added with self-registration) would lock them
  // out. Legacy docs are pre-approved as ACTIVE — they were created the old
  // way (HR → POST /employees) which had no approval workflow. Idempotent.
  const approvalBackfill = await User.updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: "ACTIVE" } },
  );
  if (approvalBackfill.modifiedCount > 0) {
    logger.info(
      { count: approvalBackfill.modifiedCount },
      "backfilled approvalStatus=ACTIVE on legacy users",
    );
  }

  // Migrate legacy role="PM" docs left over from before the role-system
  // refactor. Mongoose validation on read would otherwise reject them once we
  // tightened ROLES to ["ADMIN", "HR", "EMPLOYEE"]. Idempotent.
  const pmMigration = await User.updateMany(
    { role: "PM" },
    { $set: { role: "EMPLOYEE", isProjectManager: true } },
  );
  if (pmMigration.modifiedCount > 0) {
    logger.info(
      { count: pmMigration.modifiedCount },
      "migrated legacy role=PM users to role=EMPLOYEE + isProjectManager=true",
    );
  }

  // Backfill: pre-existing Conversation docs from before group-chat support
  // didn't have a `kind` field. Default them to DM. Idempotent.
  const convoBackfill = await Conversation.updateMany(
    { kind: { $exists: false } },
    { $set: { kind: "DM" } },
  );
  if (convoBackfill.modifiedCount > 0) {
    logger.info(
      { count: convoBackfill.modifiedCount },
      "backfilled kind=DM on legacy Conversation docs",
    );
  }

  // Backfill: pre-existing CallSession docs from before group-call support
  // used a 2-field {callerId, calleeId} shape. Convert to the new
  // {participantIds[], initiatorId, kind} shape. Idempotent: only acts on
  // docs that still have a callerId field. Uses the raw collection driver
  // because the schema no longer maps callerId/calleeId.
  try {
    const legacyCalls = await CallSession.collection
      .find({ callerId: { $exists: true } })
      .toArray();
    if (legacyCalls.length > 0) {
      for (const c of legacyCalls) {
        const callerId = (c as { callerId?: unknown }).callerId;
        const calleeId = (c as { calleeId?: unknown }).calleeId;
        if (!callerId || !calleeId) continue;
        await CallSession.collection.updateOne(
          { _id: c._id },
          {
            $set: {
              participantIds: [callerId, calleeId],
              initiatorId: callerId,
              kind: "DIRECT",
            },
            $unset: { callerId: "", calleeId: "" },
          },
        );
      }
      logger.info(
        { count: legacyCalls.length },
        "migrated legacy CallSession docs to participantIds[]/initiatorId/kind shape",
      );
    }
  } catch (err) {
    logger.warn({ err }, "CallSession legacy backfill skipped (collection may not exist yet)");
  }

  await seedDefaultDepartments();

  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      logger.info({ email: u.email, role: u.role }, "user already exists; skipping");
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 12);
    await User.create({
      email: u.email,
      passwordHash,
      name: u.name,
      role: u.role,
      isProjectManager: u.isProjectManager,
      jobTitle: u.jobTitle,
      isVerified: true,
      isActive: true,
      // Demo users have known credentials — don't force them to reset on first login.
      mustChangePassword: false,
      // Demo users skip the 2-stage approval pipeline entirely; they're seeded
      // pre-approved so the platform is usable on a fresh `pnpm seed`.
      approvalStatus: "ACTIVE",
    });
    logger.info({ email: u.email, role: u.role }, "user created");
  }

  logger.info("seed complete");
  // Only print the demo passwords in non-production environments so credentials
  // never end up in prod log aggregators / disk-resident log files.
  if (config.NODE_ENV !== "production") {
    logger.info("demo credentials:");
    for (const u of DEMO_USERS) {
      const tag = u.isProjectManager ? `${u.role} · PM` : u.role;
      logger.info(`  ${tag.padEnd(12)} ${u.email}  /  ${u.password}`);
    }
  }

  await disconnectDb();
}

main().catch((err) => {
  logger.fatal({ err }, "seed failed");
  process.exit(1);
});
