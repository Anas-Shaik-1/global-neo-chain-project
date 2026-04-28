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
}

const DEMO_USERS: DemoUser[] = [
  {
    email: config.SEED_ADMIN_EMAIL,
    password: config.SEED_ADMIN_PASSWORD,
    name: "Admin",
    role: "ADMIN",
    jobTitle: "Platform Administrator",
  },
  {
    email: "hr@global-neochain.local",
    password: "ChangeMe-HR-1!",
    name: "Hannah Rivera",
    role: "HR",
    jobTitle: "Head of People",
  },
  {
    email: "pm@global-neochain.local",
    password: "ChangeMe-PM-1!",
    name: "Priya Mehta",
    role: "PM",
    jobTitle: "Project Manager",
  },
  {
    email: "employee@global-neochain.local",
    password: "ChangeMe-Employee-1!",
    name: "Eli Mwangi",
    role: "EMPLOYEE",
    jobTitle: "Software Engineer",
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
      jobTitle: u.jobTitle,
      isVerified: true,
      isActive: true,
    });
    logger.info({ email: u.email, role: u.role }, "user created");
  }

  logger.info("seed complete — demo credentials:");
  for (const u of DEMO_USERS) {
    logger.info(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`);
  }

  await disconnectDb();
}

main().catch((err) => {
  logger.fatal({ err }, "seed failed");
  process.exit(1);
});
