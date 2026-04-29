import bcrypt from "bcrypt";
import { connectDb, disconnectDb } from "./db/index.js";
import { User, type Role } from "./models/user.model.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";

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
    });
    logger.info({ email: u.email, role: u.role }, "user created");
  }

  logger.info("seed complete — demo credentials:");
  for (const u of DEMO_USERS) {
    const tag = u.isProjectManager ? `${u.role} · PM` : u.role;
    logger.info(`  ${tag.padEnd(12)} ${u.email}  /  ${u.password}`);
  }

  await disconnectDb();
}

main().catch((err) => {
  logger.fatal({ err }, "seed failed");
  process.exit(1);
});
