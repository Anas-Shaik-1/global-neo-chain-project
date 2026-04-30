import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { User, type ApprovalStatus } from "../../models/user.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  phone?: string;
  departmentId?: string;
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
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const created = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name.trim(),
      role: "EMPLOYEE",
      isActive: true,
      isVerified: false,
      phone: input.phone || undefined,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
      approvalStatus: "PENDING_HR",
    });
    logger.info(
      { email: created.email, id: created._id.toString() },
      "self-registration submitted; awaiting HR review",
    );
    return {
      id: created._id.toString(),
      email: created.email,
      approvalStatus: created.approvalStatus as ApprovalStatus,
    };
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Email already in use");
    }
    throw err;
  }
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
