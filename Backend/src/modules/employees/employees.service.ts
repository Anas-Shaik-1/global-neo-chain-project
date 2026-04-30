import { Types } from "mongoose";
import {
  User,
  type UserDoc,
  type Role,
  type EmploymentType,
  type ApprovalStatus,
} from "../../models/user.model.js";
import { Department } from "../../models/department.model.js";
import { Position } from "../../models/position.model.js";
import { ConflictError, NotFoundError, ForbiddenError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { requestEmailVerification } from "../authExtensions/authExtensions.service.js";

interface PublicShape {
  id: string;
  email: string;
  name: string;
  role: Role;
  isProjectManager: boolean;
  isActive: boolean;
  // Approval status is part of the public shape so list / candidate views can
  // show "Pending HR review" badges without needing to fetch the full profile.
  approvalStatus: ApprovalStatus;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt?: Date;
}

interface FullShape extends PublicShape {
  hireDate?: Date | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  employmentType?: EmploymentType | null;
  emergencyContact?: { name?: string; phone?: string; relationship?: string } | null;
  resumeUrl?: string | null;
  // Approval pipeline audit trail. `approvalNotes` is HR/Admin-only on read
  // because rejection rationale shouldn't be visible to other employees.
  approvalNotes?: string | null;
  hrApprovedAt?: Date | null;
  adminApprovedAt?: Date | null;
  rejectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicProfile(u: UserDoc, departmentName: string | null): PublicShape {
  const d = u as unknown as { createdAt?: Date };
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    isProjectManager: Boolean(u.isProjectManager),
    isActive: u.isActive,
    approvalStatus: (u.approvalStatus ?? "ACTIVE") as ApprovalStatus,
    jobTitle: u.jobTitle ?? null,
    departmentId: u.departmentId ? u.departmentId.toString() : null,
    departmentName,
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
    createdAt: d.createdAt,
  };
}

export function toFullProfile(u: UserDoc, departmentName: string | null): FullShape {
  const d = u as unknown as { createdAt: Date; updatedAt: Date };
  return {
    ...toPublicProfile(u, departmentName),
    hireDate: u.hireDate ?? null,
    dateOfBirth: u.dateOfBirth ?? null,
    address: u.address ?? null,
    employmentType: u.employmentType ?? null,
    emergencyContact: u.emergencyContact
      ? {
          name: u.emergencyContact.name ?? undefined,
          phone: u.emergencyContact.phone ?? undefined,
          relationship: u.emergencyContact.relationship ?? undefined,
        }
      : null,
    resumeUrl: u.resumeUrl ?? null,
    approvalNotes: u.approvalNotes ?? null,
    hrApprovedAt: u.hrApprovedAt ?? null,
    adminApprovedAt: u.adminApprovedAt ?? null,
    rejectedAt: u.rejectedAt ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function canSeeFullProfile(requester: { id: string; role: Role }, targetId: string): boolean {
  if (requester.role === "HR" || requester.role === "ADMIN") return true;
  return requester.id === targetId;
}

async function loadDepartmentName(departmentId: Types.ObjectId | null | undefined): Promise<string | null> {
  if (!departmentId) return null;
  const d = await Department.findById(departmentId).select("name").lean();
  return d?.name ?? null;
}

export interface ListInput {
  q?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export async function listEmployees(input: ListInput) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (input.q) filter.$or = [
    { name: { $regex: input.q, $options: "i" } },
    { email: { $regex: input.q, $options: "i" } },
  ];
  if (input.departmentId) filter.departmentId = new Types.ObjectId(input.departmentId);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  const deptIds = Array.from(new Set(users.map((u) => u.departmentId?.toString()).filter(Boolean) as string[]));
  const depts = await Department.find({ _id: { $in: deptIds } }).select("name").lean();
  const nameById = new Map<string, string>();
  for (const d of depts) nameById.set(d._id.toString(), d.name);
  const items = users.map((u) =>
    toPublicProfile(u, u.departmentId ? nameById.get(u.departmentId.toString()) ?? null : null),
  );
  return { items, total, page, limit };
}

export async function getEmployee(id: string, requester: { id: string; role: Role }): Promise<PublicShape | FullShape> {
  const u = await User.findById(id);
  if (!u) throw new NotFoundError("Employee");
  const deptName = await loadDepartmentName(u.departmentId);
  if (!canSeeFullProfile(requester, id)) {
    return toPublicProfile(u, deptName);
  }
  const profile = toFullProfile(u, deptName);
  // approvalNotes (rejection rationale) is only visible to HR / Admin. A user
  // viewing their own profile gets the audit timestamps but not the note text.
  const elevated = requester.role === "HR" || requester.role === "ADMIN";
  if (!elevated) profile.approvalNotes = null;
  return profile;
}

// ---------------------------------------------------------------------------
// 2-stage approval workflow
// ---------------------------------------------------------------------------

export type CandidateStage = "hr" | "admin";

export interface ListCandidatesInput {
  stage: CandidateStage;
  page?: number;
  limit?: number;
}

/**
 * Lists candidates queued at a given approval stage. `hr` returns PENDING_HR
 * applicants; `admin` returns PENDING_ADMIN ones (HR has already cleared
 * those). Sorted by createdAt asc so the oldest application is at the top —
 * a natural FIFO review order.
 */
export async function listCandidates(input: ListCandidatesInput) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const status = input.stage === "hr" ? "PENDING_HR" : "PENDING_ADMIN";
  const filter = { approvalStatus: status };
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  const deptIds = Array.from(
    new Set(users.map((u) => u.departmentId?.toString()).filter(Boolean) as string[]),
  );
  const depts = await Department.find({ _id: { $in: deptIds } }).select("name").lean();
  const nameById = new Map<string, string>();
  for (const d of depts) nameById.set(d._id.toString(), d.name);
  const items = users.map((u) =>
    toPublicProfile(u, u.departmentId ? nameById.get(u.departmentId.toString()) ?? null : null),
  );
  return { items, total, page, limit };
}

/**
 * Notify all admins (including the approving HR if they happen to be ADMIN)
 * that a candidate is now ready for the second-stage review. Best-effort:
 * notify failures are logged and swallowed so the approval flow never aborts.
 */
async function notifyAdminsOfPendingCandidate(candidateId: string, candidateName: string) {
  try {
    const { notify } = await import("../notifications/notifications.service.js");
    const admins = await User.find({ role: "ADMIN", approvalStatus: "ACTIVE" })
      .select("_id")
      .lean();
    await Promise.all(
      admins.map((a) =>
        notify(a._id.toString(), {
          kind: "CANDIDATE_AWAITING_REVIEW",
          title: `${candidateName} is awaiting your final approval`,
          link: "/people/candidates",
        }),
      ),
    );
  } catch (err) {
    logger.warn({ err, candidateId }, "notifyAdminsOfPendingCandidate failed");
  }
}

/**
 * HR (or Admin) approves a candidate at the first stage. Transitions
 * PENDING_HR → PENDING_ADMIN, stamps `hrApprovedById` + `hrApprovedAt`, and
 * fans out a notification to all admins so the candidate doesn't sit in the
 * second queue unseen.
 *
 * Throws ConflictError if the candidate is not currently PENDING_HR — this
 * defends against double-clicks and against approving a rejected/active user.
 */
export async function approveAtHrStage(id: string, hrId: string): Promise<FullShape> {
  const u = await User.findById(id);
  if (!u) throw new NotFoundError("Candidate");
  if (u.approvalStatus !== "PENDING_HR") {
    throw new ConflictError(`Candidate is not awaiting HR approval (status: ${u.approvalStatus})`);
  }
  u.approvalStatus = "PENDING_ADMIN";
  u.hrApprovedById = new Types.ObjectId(hrId);
  u.hrApprovedAt = new Date();
  await u.save();

  void notifyAdminsOfPendingCandidate(u._id.toString(), u.name);

  const deptName = await loadDepartmentName(u.departmentId);
  return toFullProfile(u, deptName);
}

/**
 * Admin signs off as the second-stage approver. Transitions PENDING_ADMIN →
 * ACTIVE, stamps the admin audit fields, and triggers the email-verification
 * flow so the new user receives a "verify your email" link the moment their
 * account becomes usable.
 */
export async function approveAtAdminStage(id: string, adminId: string): Promise<FullShape> {
  const u = await User.findById(id);
  if (!u) throw new NotFoundError("Candidate");
  if (u.approvalStatus !== "PENDING_ADMIN") {
    throw new ConflictError(
      `Candidate is not awaiting Admin approval (status: ${u.approvalStatus})`,
    );
  }
  u.approvalStatus = "ACTIVE";
  u.adminApprovedById = new Types.ObjectId(adminId);
  u.adminApprovedAt = new Date();
  await u.save();

  // Best-effort: kick off email verification so the new user receives a
  // verification link the moment their account flips to ACTIVE. Mail-driver
  // failures are logged and swallowed; admins can resend manually.
  try {
    await requestEmailVerification(u._id.toString());
  } catch (err) {
    logger.warn(
      { email: u.email, err: (err as Error).message },
      "post-approval verification email failed; admin may resend later",
    );
  }

  const deptName = await loadDepartmentName(u.departmentId);
  return toFullProfile(u, deptName);
}

/**
 * Reject a candidate at either pending stage. HR can only reject candidates
 * that are still in HR review; Admin can reject from either queue. Optional
 * `notes` are stored on `approvalNotes` so the rationale survives in the audit
 * trail (HR/Admin can read them via the full profile).
 */
export async function rejectCandidate(
  id: string,
  byUserId: string,
  byRole: Role,
  notes?: string,
): Promise<FullShape> {
  const u = await User.findById(id);
  if (!u) throw new NotFoundError("Candidate");
  if (u.approvalStatus !== "PENDING_HR" && u.approvalStatus !== "PENDING_ADMIN") {
    throw new ConflictError(`Candidate cannot be rejected from status: ${u.approvalStatus}`);
  }
  if (byRole === "HR" && u.approvalStatus !== "PENDING_HR") {
    throw new ForbiddenError("HR can only reject candidates awaiting HR review");
  }
  if (byRole !== "HR" && byRole !== "ADMIN") {
    throw new ForbiddenError("Only HR or Admin can reject candidates");
  }
  u.approvalStatus = "REJECTED";
  u.rejectedById = new Types.ObjectId(byUserId);
  u.rejectedAt = new Date();
  u.approvalNotes = notes ?? null;
  await u.save();

  logger.info(
    { id: u._id.toString(), email: u.email, byUserId, byRole },
    "candidate rejected",
  );

  const deptName = await loadDepartmentName(u.departmentId);
  return toFullProfile(u, deptName);
}

const SELF_EDITABLE = new Set(["name", "phone", "bio", "dateOfBirth", "address", "emergencyContact"]);

export async function updateEmployee(
  id: string,
  patch: Record<string, unknown>,
  requester: { id: string; role: Role },
): Promise<FullShape> {
  const isElevated = requester.role === "HR" || requester.role === "ADMIN";
  const isSelf = requester.id === id;
  if (!isElevated && !isSelf) throw new ForbiddenError();

  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isElevated) {
      filtered[k] = v;
    } else if (SELF_EDITABLE.has(k)) {
      filtered[k] = v;
    } else {
      throw new ForbiddenError(`Field '${k}' is not editable by you`);
    }
  }

  const u = await User.findByIdAndUpdate(id, filtered, { new: true, runValidators: true });
  if (!u) throw new NotFoundError("Employee");
  const deptName = await loadDepartmentName(u.departmentId);
  return toFullProfile(u, deptName);
}

export interface AddPositionInput {
  title: string;
  departmentId?: string;
  employmentType: EmploymentType;
  startedAt: Date;
  endedAt?: Date | null;
}

export async function addPosition(userId: string, input: AddPositionInput) {
  await Position.updateMany(
    { userId: new Types.ObjectId(userId), endedAt: null },
    { $set: { endedAt: input.startedAt } },
  );
  const pos = await Position.create({
    userId: new Types.ObjectId(userId),
    title: input.title,
    departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : null,
    employmentType: input.employmentType,
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
  });
  return pos;
}

/**
 * Flips the isProjectManager sub-role flag on a user. Caller is expected to be
 * Admin — the route handles the authorization. Returns the refreshed full
 * profile so the FE can update its cached view in one round-trip.
 *
 * Only Employees can be promoted/demoted; Admin/HR already have project-creation
 * rights, and the flag would be a no-op on them.
 */
export async function setProjectManager(userId: string, value: boolean): Promise<FullShape> {
  const u = await User.findById(userId);
  if (!u) throw new NotFoundError("Employee");
  if (u.role !== "EMPLOYEE") {
    throw new ForbiddenError("Only employees can be promoted to Project Manager");
  }
  const wasManager = u.isProjectManager === true;
  u.isProjectManager = value;
  await u.save();
  const deptName = await loadDepartmentName(u.departmentId);
  if (value && !wasManager) {
    void (async () => {
      const { notify } = await import("../notifications/notifications.service.js");
      await notify(u._id.toString(), {
        kind: "PROMOTED_TO_PM",
        title: "You're now a Project Manager",
        link: "/profile",
      });
    })().catch((err) => logger.warn({ err }, "employees.setProjectManager notify failed"));
  }
  return toFullProfile(u, deptName);
}

export async function deactivate(id: string): Promise<void> {
  const u = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!u) throw new NotFoundError("Employee");
  await Position.updateMany(
    { userId: new Types.ObjectId(id), endedAt: null },
    { $set: { endedAt: new Date() } },
  );
}

export async function listPositions(userId: string) {
  const positions = await Position.find({ userId: new Types.ObjectId(userId) }).sort({ startedAt: -1 });
  const deptIds = Array.from(new Set(positions.map((p) => p.departmentId?.toString()).filter(Boolean) as string[]));
  const depts = await Department.find({ _id: { $in: deptIds } }).select("name").lean();
  const nameById = new Map<string, string>();
  for (const d of depts) nameById.set(d._id.toString(), d.name);
  return positions.map((p) => ({
    id: p._id.toString(),
    userId: p.userId.toString(),
    title: p.title,
    departmentId: p.departmentId ? p.departmentId.toString() : null,
    departmentName: p.departmentId ? nameById.get(p.departmentId.toString()) ?? null : null,
    employmentType: p.employmentType,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
  }));
}

export async function updatePosition(positionId: string, patch: Partial<AddPositionInput>) {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.departmentId !== undefined) update.departmentId = patch.departmentId ? new Types.ObjectId(patch.departmentId) : null;
  if (patch.employmentType !== undefined) update.employmentType = patch.employmentType;
  if (patch.startedAt !== undefined) update.startedAt = patch.startedAt;
  if (patch.endedAt !== undefined) update.endedAt = patch.endedAt;
  const p = await Position.findByIdAndUpdate(positionId, update, { new: true });
  if (!p) throw new NotFoundError("Position");
  return p;
}
