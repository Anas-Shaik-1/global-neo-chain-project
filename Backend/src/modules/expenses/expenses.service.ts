import { Types } from "mongoose";
import {
  Expense,
  type ExpenseDoc,
  type ExpenseCategory,
  type ExpenseStatus,
} from "../../models/expense.model.js";
import { User } from "../../models/user.model.js";
import type { Role } from "../../models/user.model.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { createFileStorage, type FileInput } from "../../lib/storage.js";

const storage = createFileStorage();

export interface ExpenseResponseShape {
  id: string;
  userId: string;
  userName: string | null;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  incurredOn: Date;
  receiptUrl: string | null;
  status: ExpenseStatus;
  decisionById: string | null;
  decisionByName: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Requester {
  id: string;
  role: Role;
}

function isElevated(role: Role): boolean {
  return role === "HR" || role === "ADMIN";
}

async function buildUserNamesMap(
  userIds: (Types.ObjectId | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(userIds.filter((i): i is Types.ObjectId => !!i).map((i) => i.toString())),
  );
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const users = await User.find({ _id: { $in: ids } }).select("name").lean();
  for (const u of users) map.set(u._id.toString(), u.name);
  return map;
}

export function denormalizeExpense(
  e: ExpenseDoc,
  userNames: Map<string, string>,
): ExpenseResponseShape {
  const ts = e as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: e._id.toString(),
    userId: e.userId.toString(),
    userName: userNames.get(e.userId.toString()) ?? null,
    amount: e.amount,
    currency: e.currency,
    category: e.category as ExpenseCategory,
    description: e.description,
    incurredOn: e.incurredOn,
    receiptUrl: e.receiptUrl ?? null,
    status: e.status as ExpenseStatus,
    decisionById: e.decisionById ? e.decisionById.toString() : null,
    decisionByName: e.decisionById
      ? userNames.get(e.decisionById.toString()) ?? null
      : null,
    decisionNote: e.decisionNote ?? null,
    decidedAt: e.decidedAt ?? null,
    createdAt: ts.createdAt,
    updatedAt: ts.updatedAt,
  };
}

async function denormalizeMany(docs: ExpenseDoc[]): Promise<ExpenseResponseShape[]> {
  const ids: (Types.ObjectId | null)[] = [];
  for (const d of docs) {
    ids.push(d.userId);
    if (d.decisionById) ids.push(d.decisionById);
  }
  const userNames = await buildUserNamesMap(ids);
  return docs.map((d) => denormalizeExpense(d, userNames));
}

async function denormalizeOne(doc: ExpenseDoc): Promise<ExpenseResponseShape> {
  const userNames = await buildUserNamesMap([doc.userId, doc.decisionById]);
  return denormalizeExpense(doc, userNames);
}

export interface ListMyInput {
  status?: ExpenseStatus;
  page?: number;
  limit?: number;
}

export interface ListAllInput extends ListMyInput {
  userId?: string;
}

export interface PagedExpenses {
  items: ExpenseResponseShape[];
  total: number;
  page: number;
  limit: number;
}

export async function listMyExpenses(
  userId: string,
  input: ListMyInput,
): Promise<PagedExpenses> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (input.status) filter.status = input.status;
  const [docs, total] = await Promise.all([
    Expense.find(filter)
      .sort({ incurredOn: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filter),
  ]);
  const items = await denormalizeMany(docs);
  return { items, total, page, limit };
}

export async function listAll(input: ListAllInput): Promise<PagedExpenses> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.userId) filter.userId = new Types.ObjectId(input.userId);
  const [docs, total] = await Promise.all([
    Expense.find(filter)
      .sort({ status: 1, incurredOn: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filter),
  ]);
  const items = await denormalizeMany(docs);
  return { items, total, page, limit };
}

export async function getExpense(
  id: string,
  requester: Requester,
): Promise<ExpenseResponseShape> {
  const doc = await Expense.findById(id);
  if (!doc) throw new NotFoundError("Expense");
  if (!isElevated(requester.role) && doc.userId.toString() !== requester.id) {
    throw new ForbiddenError();
  }
  return denormalizeOne(doc);
}

function ensureSelfOrElevated(
  ownerId: Types.ObjectId,
  requester: Requester,
) {
  if (!isElevated(requester.role) && ownerId.toString() !== requester.id) {
    throw new ForbiddenError();
  }
}

export interface CreateExpenseInput {
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  description: string;
  incurredOn: Date;
}

export async function createExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseResponseShape> {
  if (input.amount < 0) {
    throw new ValidationError("amount must be >= 0");
  }
  const created = await Expense.create({
    userId: new Types.ObjectId(userId),
    amount: input.amount,
    currency: input.currency ?? "USD",
    category: input.category,
    description: input.description,
    incurredOn: input.incurredOn,
    status: "PENDING",
    receiptUrl: null,
    decisionById: null,
    decisionNote: null,
    decidedAt: null,
  });
  return denormalizeOne(created);
}

export type ExpenseDecision = "APPROVED" | "REJECTED";

export async function decideExpense(
  id: string,
  deciderId: string,
  decision: ExpenseDecision,
  note?: string,
): Promise<ExpenseResponseShape> {
  const doc = await Expense.findById(id);
  if (!doc) throw new NotFoundError("Expense");
  if (doc.status !== "PENDING") {
    throw new ConflictError(`Expense already ${doc.status.toLowerCase()}`);
  }
  doc.status = decision;
  doc.decisionById = new Types.ObjectId(deciderId);
  doc.decisionNote = note ?? null;
  doc.decidedAt = new Date();
  await doc.save();
  return denormalizeOne(doc);
}

export async function setReceipt(
  expenseId: string,
  requester: Requester,
  file: FileInput,
): Promise<ExpenseResponseShape> {
  const doc = await Expense.findById(expenseId).select("+receiptKey");
  if (!doc) throw new NotFoundError("Expense");
  ensureSelfOrElevated(doc.userId, requester);
  const saved = await storage.save("receipt", doc.userId.toString(), file);
  if (doc.receiptKey) {
    try {
      await storage.delete(doc.receiptKey);
    } catch {
      // best-effort cleanup
    }
  }
  doc.receiptKey = saved.key;
  doc.receiptUrl = saved.url;
  await doc.save();
  return denormalizeOne(doc);
}

export async function clearReceipt(
  expenseId: string,
  requester: Requester,
): Promise<ExpenseResponseShape> {
  const doc = await Expense.findById(expenseId).select("+receiptKey");
  if (!doc) throw new NotFoundError("Expense");
  ensureSelfOrElevated(doc.userId, requester);
  if (doc.receiptKey) {
    try {
      await storage.delete(doc.receiptKey);
    } catch {
      // best-effort cleanup
    }
  }
  doc.receiptKey = undefined;
  doc.receiptUrl = null;
  await doc.save();
  return denormalizeOne(doc);
}
