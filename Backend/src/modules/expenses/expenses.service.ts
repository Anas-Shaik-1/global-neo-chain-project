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
import { toInrCents, formatCurrency, getInrRateAt } from "../../lib/currency.js";
import { logger } from "../../lib/logger.js";

/**
 * Asserts an integer-money value (paise/cents) is a non-negative integer.
 * Stops fractional or negative writes from polluting the DB at the service
 * boundary so reads don't have to defensively round.
 */
function assertIntegerMoney(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(
      `${label} must be a non-negative integer in minor units (got ${value})`,
    );
  }
}

/**
 * Resolve the INR-paise equivalent of a stored expense amount, preferring the
 * FX-rate snapshot taken at write time over today's stub rate. Falls back to
 * `getInrRateAt` for older rows that pre-date the snapshot.
 */
function resolveInrCents(doc: ExpenseDoc): number {
  const snap = (doc as unknown as { fxRateInrAtCreate?: number }).fxRateInrAtCreate;
  if (typeof snap === "number" && Number.isFinite(snap) && snap > 0) {
    return Math.round(doc.amount * snap);
  }
  return Math.round(doc.amount * getInrRateAt(doc.currency));
}

const storage = createFileStorage();

export interface ExpenseResponseShape {
  id: string;
  userId: string;
  userName: string | null;
  amount: number;
  currency: string;
  amountInr: number;
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
    // Prefer the FX rate snapshotted at write time (`fxRateInrAtCreate`) so
    // historical rows don't silently re-rate when prod swaps in a real FX
    // provider. Fallback path uses today's stub rate for legacy rows.
    amountInr: resolveInrCents(e),
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

export interface ExpensesSummary {
  totalInrCents: number;
}

export interface PagedExpenses {
  items: ExpenseResponseShape[];
  total: number;
  page: number;
  limit: number;
  summary: ExpensesSummary;
}

/**
 * Total INR-paise across the *full* filtered set (not just the current page).
 * Groups by (currency, fxRateInrAtCreate) at the DB layer so rows with a
 * write-time FX snapshot use that exact rate, while older rows without a
 * snapshot fall back to today's stub rate via `toInrCents`. Mixed-currency
 * rows still produce a single coherent total.
 */
async function summarizeByFilter(
  filter: Record<string, unknown>,
): Promise<ExpensesSummary> {
  const agg = await Expense.aggregate<{
    _id: { currency: string; fx: number | null };
    total: number;
  }>([
    { $match: filter },
    {
      $group: {
        _id: {
          currency: "$currency",
          fx: { $ifNull: ["$fxRateInrAtCreate", null] },
        },
        total: { $sum: "$amount" },
      },
    },
  ]);
  let totalInrCents = 0;
  for (const row of agg) {
    if (
      typeof row._id.fx === "number" &&
      Number.isFinite(row._id.fx) &&
      row._id.fx > 0
    ) {
      totalInrCents += Math.round(row.total * row._id.fx);
    } else {
      totalInrCents += toInrCents(row.total, row._id.currency);
    }
  }
  return { totalInrCents };
}

export async function listMyExpenses(
  userId: string,
  input: ListMyInput,
): Promise<PagedExpenses> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (input.status) filter.status = input.status;
  const [docs, total, summary] = await Promise.all([
    Expense.find(filter)
      .sort({ incurredOn: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filter),
    summarizeByFilter(filter),
  ]);
  const items = await denormalizeMany(docs);
  return { items, total, page, limit, summary };
}

export async function listAll(input: ListAllInput): Promise<PagedExpenses> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.userId) filter.userId = new Types.ObjectId(input.userId);
  const [docs, total, summary] = await Promise.all([
    Expense.find(filter)
      .sort({ status: 1, incurredOn: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filter),
    summarizeByFilter(filter),
  ]);
  const items = await denormalizeMany(docs);
  return { items, total, page, limit, summary };
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
  // Integer-money guard: reject fractional cents at the service boundary.
  assertIntegerMoney(input.amount, "amount");
  const currency = input.currency ?? "INR";
  // Snapshot the FX rate at write time so historical aggregations don't
  // silently re-rate when prod swaps the stub for a real FX provider.
  // STUB: `getInrRateAt` returns the hard-coded rate today; see lib/currency.ts.
  const fxRateInrAtCreate = getInrRateAt(currency, new Date());
  // TODO(fx-snapshot-schema): the model agent owns the schema for
  // `fxRateInrAtCreate`. Until the schema lands as non-strict, mongoose's
  // default `strict: true` will silently drop unknown fields. Use
  // `created.set(..., { strict: false })` after create as a safety net.
  const created = await Expense.create({
    userId: new Types.ObjectId(userId),
    amount: input.amount,
    currency,
    category: input.category,
    description: input.description,
    incurredOn: input.incurredOn,
    status: "PENDING",
    receiptUrl: null,
    decisionById: null,
    decisionNote: null,
    decidedAt: null,
    fxRateInrAtCreate,
  });
  // If the schema is strict and dropped the field on create, force-set it
  // un-strictly so reads see the snapshot. Idempotent if it was already set.
  if (
    (created as unknown as { fxRateInrAtCreate?: number }).fxRateInrAtCreate ===
    undefined
  ) {
    created.set("fxRateInrAtCreate", fxRateInrAtCreate, { strict: false });
    await created.save();
  }
  const result = await denormalizeOne(created);
  // Fire-and-forget admin notifications. Failures here must never block the
  // user-visible "expense submitted" success path.
  void notifyExpenseSubmitted(result).catch((err) => {
    logger.warn({ err }, "expenses.createExpense notify failed");
  });
  return result;
}

async function notifyExpenseSubmitted(expense: ExpenseResponseShape): Promise<void> {
  const { notify } = await import("../notifications/notifications.service.js");
  const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
  const submitterName = expense.userName ?? "An employee";
  const body = `${formatCurrency(expense.amount, expense.currency)} for ${expense.category}`;
  await Promise.all(
    admins.map((a) =>
      notify(a._id.toString(), {
        kind: "EXPENSE_SUBMITTED",
        title: `${submitterName} submitted an expense`,
        body,
        link: "/expenses",
      }),
    ),
  );
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
  const result = await denormalizeOne(doc);
  void notifyExpenseDecided(result, decision, note).catch((err) => {
    logger.warn({ err }, "expenses.decideExpense notify failed");
  });
  return result;
}

async function notifyExpenseDecided(
  expense: ExpenseResponseShape,
  decision: ExpenseDecision,
  note?: string,
): Promise<void> {
  const { notify } = await import("../notifications/notifications.service.js");
  const verb = decision === "APPROVED" ? "approved" : "rejected";
  await notify(expense.userId, {
    kind: decision === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
    title: `Expense ${verb}`,
    body: note?.trim() ? note : `Your ${expense.category} expense was ${verb}`,
    link: "/expenses",
  });
}

export async function setReceipt(
  expenseId: string,
  requester: Requester,
  file: FileInput,
): Promise<ExpenseResponseShape> {
  const doc = await Expense.findById(expenseId).select("+receiptKey");
  if (!doc) throw new NotFoundError("Expense");
  ensureSelfOrElevated(doc.userId, requester);
  // Receipt is locked once a decision has been made — approved/rejected
  // expenses must not have their evidence swapped out after the fact.
  if (doc.status !== "PENDING") {
    throw new ConflictError(
      `Cannot modify receipt: expense is ${doc.status.toLowerCase()}`,
    );
  }
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
  // Receipt is locked once a decision has been made — approved/rejected
  // expenses must not have their evidence removed after the fact.
  if (doc.status !== "PENDING") {
    throw new ConflictError(
      `Cannot modify receipt: expense is ${doc.status.toLowerCase()}`,
    );
  }
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
