import bcrypt from "bcrypt";
import { connectDb, disconnectDb } from "./db/index.js";
import { User } from "./models/user.model.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";

async function main() {
  await connectDb();
  const existing = await User.findOne({ email: config.SEED_ADMIN_EMAIL });
  if (existing) {
    logger.info({ email: config.SEED_ADMIN_EMAIL }, "admin already exists; skipping");
  } else {
    const passwordHash = await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 12);
    await User.create({
      email: config.SEED_ADMIN_EMAIL,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      isVerified: true,
    });
    logger.info({ email: config.SEED_ADMIN_EMAIL }, "admin created");
  }
  await disconnectDb();
}

main().catch((err) => {
  logger.fatal({ err }, "seed failed");
  process.exit(1);
});
