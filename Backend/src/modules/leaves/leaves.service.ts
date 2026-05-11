import { Types } from "mongoose";
import {
  LeaveRequest,
  type LeaveRequestDoc,
  type LeaveStatus,
  type LeaveType,
} from "../../models/leaveRequest.model.js";
import { User, type Role } from "../../models/user.model.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notify, notifyMany } from "../notifications/notifications.service.js";

export interface PublicLeave {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  decisionById: string | null;
  decisionByName: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Actor {
  id: string;
  role: Role;
}

function toUtcMidnight(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ValidationError("Invalid date");
  return d;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

interface UserStub {
  id: string;
  name: string | null;
  email: string | null;
}

async function loadUsers(ids: Types.ObjectId[]): Promise<Map<string, UserStub>> {
  const unique = Array.from(new Set(ids.map((i) => i.toString())));
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select({ name: 1, email: 1 })
    .lean();
  const map = new Map<string, UserStub>();
  for (const u of users) {
    map.set(u._id.toString(), {
      id: u._id.toString(),
      name: u.name ?? null,
      email: u.email ?? null,
    });
  }
  return map;
}

function toPublic(doc: LeaveRequestDoc, users: Map<string, UserStub>): PublicLeave {
  const owner = users.get(doc.userId.toString()) ?? null;
  const decider = doc.decisionById
    ? users.get(doc.decisionById.toString()) ?? null
    : null;
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    userName: owner?.name ?? null,
    userEmail: owner?.email ?? null,
    type: doc.type as LeaveType,
    startDate: doc.startDate.toISOString().slice(0, 10),
    endDate: doc.endDate.toISOString().slice(0, 10),
    reason: doc.reason,
    status: doc.status as LeaveStatus,
    decisionById: doc.decisionById ? doc.decisionById.toString() : null,
    decisionByName: decider?.name ?? null,
    decisionAt: doc.decisionAt ? doc.decisionAt.toISOString() : null,
    decisionNotes: doc.decisionNotes ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function requireDoc(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Leave");
  const doc = await LeaveRequest.findById(id);
  if (!doc) throw new NotFoundError("Leave");
  return doc;
}

function ensureAdmin(actor: Actor): void {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Admins only");
}

export interface CreateLeaveInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function createLeave(
  actor: Actor,
  input: CreateLeaveInput,
): Promise<PublicLeave> {
  const start = toUtcMidnight(input.startDate);
  const end = toUtcMidnight(input.endDate);
  if (end < start) throw new ValidationError("Invalid date range");
  if (start < todayUtc()) throw new ValidationError("Start date is in the past");

  const overlap = await LeaveRequest.exists({
    userId: new Types.ObjectId(actor.id),
    status: { $in: ["PENDING", "APPROVED"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) {
    throw new ConflictError("Overlaps an existing leave request");
  }

  const created = await LeaveRequest.create({
    userId: new Types.ObjectId(actor.id),
    type: input.type,
    startDate: start,
    endDate: end,
    reason: input.reason,
    status: "PENDING",
  });

  try {
    const admins = await User.find({ role: "ADMIN", isActive: true })
      .select({ _id: 1 })
      .lean();
    if (admins.length > 0) {
      const owner = await User.findById(actor.id).select({ name: 1 }).lean();
      await notifyMany(
        admins.map((a) => a._id.toString()),
        {
          kind: "LEAVE_SUBMITTED",
          title: `New leave request from ${owner?.name ?? "an employee"}`,
          body: `${input.type} · ${input.startDate} → ${input.endDate}`,
          link: "/leaves",
        },
      );
    }
  } catch (err) {
    logger.warn({ err }, "leaves: admin notify on create failed");
  }

  const users = await loadUsers([created.userId]);
  return toPublic(created, users);
}

export async function approveLeave(id: string, actor: Actor): Promise<PublicLeave> {
  ensureAdmin(actor);
  const doc = await requireDoc(id);
  if (doc.status !== "PENDING") {
    throw new ConflictError("Leave is no longer pending");
  }
  doc.status = "APPROVED";
  doc.decisionById = new Types.ObjectId(actor.id);
  doc.decisionAt = new Date();
  doc.decisionNotes = null;
  await doc.save();

  try {
    await notify(doc.userId.toString(), {
      kind: "LEAVE_APPROVED",
      title: "Leave request approved",
      body: `${doc.type} · ${doc.startDate.toISOString().slice(0, 10)} → ${doc.endDate
        .toISOString()
        .slice(0, 10)}`,
      link: "/leaves",
    });
  } catch (err) {
    logger.warn({ err }, "leaves: filer notify on approve failed");
  }

  const users = await loadUsers([doc.userId, doc.decisionById]);
  return toPublic(doc, users);
}

export interface RejectInput {
  notes?: string;
}

export async function rejectLeave(
  id: string,
  actor: Actor,
  input: RejectInput,
): Promise<PublicLeave> {
  ensureAdmin(actor);
  const doc = await requireDoc(id);
  if (doc.status !== "PENDING") {
    throw new ConflictError("Leave is no longer pending");
  }
  doc.status = "REJECTED";
  doc.decisionById = new Types.ObjectId(actor.id);
  doc.decisionAt = new Date();
  doc.decisionNotes = input.notes ?? null;
  await doc.save();

  try {
    await notify(doc.userId.toString(), {
      kind: "LEAVE_REJECTED",
      title: "Leave request rejected",
      body: input.notes ? input.notes : `${doc.type} request was rejected`,
      link: "/leaves",
    });
  } catch (err) {
    logger.warn({ err }, "leaves: filer notify on reject failed");
  }

  const users = await loadUsers([doc.userId, doc.decisionById]);
  return toPublic(doc, users);
}

export async function cancelLeave(id: string, actor: Actor): Promise<PublicLeave> {
  const doc = await requireDoc(id);
  if (doc.userId.toString() !== actor.id) {
    throw new ForbiddenError("Only the owner can cancel");
  }
  if (doc.status !== "PENDING") {
    throw new ConflictError("Leave is no longer pending");
  }
  doc.status = "CANCELLED";
  await doc.save();
  const users = await loadUsers([doc.userId]);
  return toPublic(doc, users);
}

export interface ListInput {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  type?: LeaveType;
  userId?: string;
  from?: string;
  to?: string;
}

interface Page {
  items: PublicLeave[];
  total: number;
  page: number;
  limit: number;
}

function pageParams(input: ListInput): { page: number; limit: number; skip: number } {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  return { page, limit, skip: (page - 1) * limit };
}

export async function listMineLeaves(userId: string, input: ListInput): Promise<Page> {
  const { page, limit, skip } = pageParams(input);
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (input.status) filter.status = input.status;
  if (input.type) filter.type = input.type;
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  const users = await loadUsers(
    items.flatMap((d) => [d.userId, d.decisionById].filter(Boolean) as Types.ObjectId[]),
  );
  return { items: items.map((d) => toPublic(d, users)), total, page, limit };
}

export async function listAllLeaves(actor: Actor, input: ListInput): Promise<Page> {
  ensureAdmin(actor);
  const { page, limit, skip } = pageParams(input);
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.type) filter.type = input.type;
  if (input.userId) filter.userId = new Types.ObjectId(input.userId);
  if (input.from || input.to) {
    const from = input.from ? toUtcMidnight(input.from) : null;
    const to = input.to ? toUtcMidnight(input.to) : null;
    if (from) (filter as Record<string, unknown>).endDate = { $gte: from };
    if (to) (filter as Record<string, unknown>).startDate = { $lte: to };
  }
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  const users = await loadUsers(
    items.flatMap((d) => [d.userId, d.decisionById].filter(Boolean) as Types.ObjectId[]),
  );
  return { items: items.map((d) => toPublic(d, users)), total, page, limit };
}
