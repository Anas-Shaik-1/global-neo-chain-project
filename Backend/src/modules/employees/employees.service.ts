import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Types } from "mongoose";
import { User, type UserDoc, type Role, type EmploymentType } from "../../models/user.model.js";
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
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}

interface FullShape extends PublicShape {
  hireDate?: Date | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  employmentType?: EmploymentType | null;
  emergencyContact?: { name?: string; phone?: string; relationship?: string } | null;
  resumeUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicProfile(u: UserDoc, departmentName: string | null): PublicShape {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    isProjectManager: Boolean(u.isProjectManager),
    isActive: u.isActive,
    jobTitle: u.jobTitle ?? null,
    departmentId: u.departmentId ? u.departmentId.toString() : null,
    departmentName,
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
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
  return canSeeFullProfile(requester, id) ? toFullProfile(u, deptName) : toPublicProfile(u, deptName);
}

export interface CreateInput {
  email: string;
  name: string;
  role: Role;
  jobTitle?: string;
  departmentId?: string;
}

export async function createEmployee(input: CreateInput): Promise<{ profile: FullShape; tempPassword: string }> {
  const tempPassword = crypto.randomBytes(16).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  try {
    const created = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
      jobTitle: input.jobTitle,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : undefined,
      isActive: true,
    });
    logger.info({ email: created.email }, `created employee ${created.email} with temp password ${tempPassword}`);

    // Best-effort: kick off email verification so the new hire receives a
    // verification link straight after onboarding. We deliberately swallow
    // any mail-driver / token-creation failures so the create flow always
    // succeeds — HR can resend later via the in-app banner.
    try {
      await requestEmailVerification(created._id.toString());
    } catch (err) {
      logger.warn(
        { email: created.email, err: (err as Error).message },
        "auto-send verification email failed; HR may resend later",
      );
    }

    const deptName = await loadDepartmentName(created.departmentId);
    return { profile: toFullProfile(created, deptName), tempPassword };
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Email already exists");
    }
    throw err;
  }
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
  u.isProjectManager = value;
  await u.save();
  const deptName = await loadDepartmentName(u.departmentId);
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
