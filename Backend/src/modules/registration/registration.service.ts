import bcrypt from "bcrypt";
import { User, type ApprovalStatus } from "../../models/user.model.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { toIndianE164 } from "../../lib/phone.js";
import { createFileStorage } from "../../lib/storage.js";

const BCRYPT_ROUNDS = 12;

// Instantiating per call so test setups that swap UPLOADS_DIR per test pick
// up the correct root. The factory is cheap (no I/O).

export interface RegisterAvatarInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  phone?: string;
  /**
   * Profile picture is mandatory at registration so HR has something to
   * recognise the candidate by during review and so the new user lands in
   * the directory with an avatar from day one.
   */
  avatar: RegisterAvatarInput;
}

export interface RegisterResult {
  id: string;
  email: string;
  approvalStatus: ApprovalStatus;
}

/**
 * Public self-registration. Creates a new EMPLOYEE-role User with
 * `approvalStatus: "PENDING_HR"`. The account cannot log in until HR + Admin
 * sign off and the status flips to ACTIVE (see auth.service login gate).
 *
 * The password is hashed with bcrypt at the standard rounds; the email is
 * lowercased and uniqueness is enforced by the model's unique index. A 11000
 * duplicate-key from Mongo is translated to a 409 ConflictError so the FE can
 * render a friendly "email already in use" message.
 *
 * Department assignment is intentionally HR/Admin's responsibility — done as
 * part of the approval flow, not during candidate signup.
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  // Avatar is required by the route layer (multer attaches the file before
  // we get here) but we re-check defensively so direct callers can't bypass.
  if (!input.avatar || !input.avatar.buffer || input.avatar.buffer.length === 0) {
    throw new ValidationError("avatar (profile picture) is required");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  let created;
  try {
    created = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name.trim(),
      role: "EMPLOYEE",
      isActive: true,
      isVerified: false,
      phone: toIndianE164(input.phone),
      approvalStatus: "PENDING_HR",
    });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Email already in use");
    }
    throw err;
  }

  // Persist the avatar against the new user's id so the storage key follows
  // the same `<scope>/<userId>-<uuid>.<ext>` shape as every other upload. If
  // saving the file fails we roll back the User insert so registration is
  // all-or-nothing — there's no orphan account without an avatar.
  const storage = createFileStorage();
  let saved;
  try {
    saved = await storage.save("avatar", created._id.toString(), {
      originalName: input.avatar.originalName,
      mimeType: input.avatar.mimeType,
      buffer: input.avatar.buffer,
    });
    created.avatarUrl = saved.url;
    if (saved.variants) {
      created.avatarVariants = {
        small: saved.variants.small,
        medium: saved.variants.medium,
        large: saved.variants.large,
      };
    }
    await created.save();
  } catch (err) {
    await User.deleteOne({ _id: created._id }).catch((cleanupErr) =>
      logger.warn(
        { cleanupErr, id: created!._id.toString() },
        "registration: rollback after avatar save failed",
      ),
    );
    throw err;
  }

  logger.info(
    { email: created.email, id: created._id.toString() },
    "self-registration submitted; awaiting HR review",
  );

  // Best-effort: notify HR staff so they see new applications without
  // having to manually refresh the candidates queue.
  void (async () => {
    const { notifyMany } = await import(
      "../notifications/notifications.service.js"
    );
    const hrUsers = await User.find({
      role: "HR",
      approvalStatus: "ACTIVE",
      isActive: true,
    })
      .select("_id")
      .lean();
    await notifyMany(
      hrUsers.map((u) => u._id.toString()),
      {
        kind: "CANDIDATE_REGISTERED",
        title: `${created.name} just applied`,
        body: created.email,
        link: "/people/candidates",
      },
    );
  })().catch((err) =>
    logger.warn({ err }, "registration: notify HR failed"),
  );

  return {
    id: created._id.toString(),
    email: created.email,
    approvalStatus: created.approvalStatus as ApprovalStatus,
  };
}

export interface RegistrationStatusResult {
  approvalStatus: ApprovalStatus;
}

/**
 * Public status lookup for a registration. Returns ONLY the approval stage —
 * no other user details, to keep this endpoint safe to expose unauthenticated.
 * Throws NotFoundError if no user exists for the email so applicants can tell
 * apart "I haven't applied" from "I'm in the queue".
 */
export async function getRegistrationStatus(email: string): Promise<RegistrationStatusResult> {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select("approvalStatus")
    .lean();
  if (!user) throw new NotFoundError("Registration");
  return { approvalStatus: user.approvalStatus as ApprovalStatus };
}
