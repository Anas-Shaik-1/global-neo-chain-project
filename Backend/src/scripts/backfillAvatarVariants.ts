/**
 * One-shot migration: ensures every existing User has an `avatarVariants`
 * sub-document populated, so the FE never has to handle the `undefined`
 * case. Run this once after deploying the Cloudinary support; safe to
 * re-run.
 *
 * Two modes, picked from the CLI:
 *
 *   • `local`: copy `avatarUrl` into all three variant fields. Use this
 *     when STORAGE_DRIVER=local — the variants are placeholder URLs
 *     pointing at the same image.
 *
 *   • `cloudinary`: re-derive Cloudinary transformation URLs from the
 *     stored `avatarKey` (which is the Cloudinary public_id). Only valid
 *     when STORAGE_DRIVER=cloudinary AND the user uploaded their avatar
 *     via Cloudinary in the first place (i.e. `avatarUrl` is on the CDN).
 *
 * Usage:
 *   pnpm --dir Backend tsx src/scripts/backfillAvatarVariants.ts local
 *   pnpm --dir Backend tsx src/scripts/backfillAvatarVariants.ts cloudinary
 */

import { v2 as cloudinary } from "cloudinary";
import { connectDb, disconnectDb } from "../db/index.js";
import { config } from "../config/index.js";
import { User } from "../models/user.model.js";
import { logger } from "../lib/logger.js";

type Mode = "local" | "cloudinary";

async function main() {
  const mode = (process.argv[2] ?? "").toLowerCase() as Mode;
  if (mode !== "local" && mode !== "cloudinary") {
    console.error(
      "Usage: tsx src/scripts/backfillAvatarVariants.ts <local|cloudinary>",
    );
    process.exit(2);
  }

  await connectDb();

  if (mode === "cloudinary") {
    if (
      !config.CLOUDINARY_CLOUD_NAME ||
      !config.CLOUDINARY_API_KEY ||
      !config.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        "cloudinary mode requires CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in env",
      );
    }
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  const cursor = User.find({
    avatarUrl: { $ne: null },
  })
    .select("_id avatarUrl avatarKey avatarVariants")
    .cursor();

  let scanned = 0;
  let updated = 0;
  for await (const u of cursor) {
    scanned += 1;
    const v = u.avatarVariants;
    const alreadyDone =
      !!v && !!v.small && !!v.medium && !!v.large;
    if (alreadyDone) continue;

    if (mode === "local") {
      const url = u.avatarUrl ?? null;
      if (!url) continue;
      u.avatarVariants = { small: url, medium: url, large: url };
    } else {
      // Need a Cloudinary public_id to derive the variant URLs. We stored
      // it as `avatarKey`. If the user was uploaded via local storage their
      // key won't be a Cloudinary public_id and we skip them.
      const publicId = u.avatarKey;
      if (!publicId) continue;
      const cloud = (transform: Record<string, unknown>) =>
        cloudinary.url(publicId, {
          secure: true,
          transformation: [transform, { quality: "auto:good", fetch_format: "auto" }],
        });
      u.avatarVariants = {
        small: cloud({ width: 64, height: 64, crop: "thumb", gravity: "face" }),
        medium: cloud({ width: 128, height: 128, crop: "thumb", gravity: "face" }),
        large: cloud({ width: 512, height: 512, crop: "thumb", gravity: "face" }),
      };
    }
    await u.save();
    updated += 1;
  }

  logger.info({ scanned, updated, mode }, "avatar variants backfill complete");
  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, "backfill failed");
  try {
    await disconnectDb();
  } catch {
    // ignore
  }
  process.exit(1);
});
