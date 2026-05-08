import mongoose, { Types } from "mongoose";
import {
  Payslip,
  type PayslipDoc,
  type BreakdownKind,
} from "../../models/payslip.model.js";
import { Expense } from "../../models/expense.model.js";
import { User, type UserDoc } from "../../models/user.model.js";
import type { Role } from "../../models/user.model.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { createFileStorage } from "../../lib/storage.js";
import { generatePayslipPdf } from "../../lib/pdf.js";
import { logger } from "../../lib/logger.js";
import { getMailDriver } from "../../lib/mail.js";
import { formatCurrency, getInrRateAt } from "../../lib/currency.js";

/**
 * Asserts an integer-money value (paise/cents) is a non-negative integer.
 * Stops fractional or negative writes from polluting the DB at the service
 * boundary so we don't have to defensively round on every read.
 */
function assertIntegerMoney(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(
      `${label} must be a non-negative integer in minor units (got ${value})`,
    );
  }
}

const storage = createFileStorage();

export interface BreakdownItem {
  label: string;
  amount: number;
  kind: BreakdownKind;
}

export interface PayslipResponseShape {
  id: string;
  userId: string;
  userName: string | null;
  month: string;
  currency: string;
  gross: number;
  breakdown: BreakdownItem[];
  netAmount: number;
  notes: string | null;
  generatedById: string;
  generatedByName: string | null;
  pdfUrl: string | null;
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

export function denormalizePayslip(
  p: PayslipDoc,
  userNames: Map<string, string>,
): PayslipResponseShape {
  const ts = p as unknown as { createdAt: Date; updatedAt: Date };
  const breakdown = (p.breakdown ?? []) as BreakdownItem[];
  return {
    id: p._id.toString(),
    userId: p.userId.toString(),
    userName: userNames.get(p.userId.toString()) ?? null,
    month: p.month,
    currency: p.currency,
    gross: p.gross,
    breakdown: breakdown.map((b) => ({
      label: b.label,
      amount: b.amount,
      kind: b.kind,
    })),
    netAmount: p.netAmount,
    notes: p.notes ?? null,
    generatedById: p.generatedById.toString(),
    generatedByName: userNames.get(p.generatedById.toString()) ?? null,
    pdfUrl: p.pdfUrl ?? null,
    createdAt: ts.createdAt,
    updatedAt: ts.updatedAt,
  };
}

async function denormalizeMany(docs: PayslipDoc[]): Promise<PayslipResponseShape[]> {
  const ids: Types.ObjectId[] = [];
  for (const d of docs) {
    ids.push(d.userId);
    ids.push(d.generatedById);
  }
  const userNames = await buildUserNamesMap(ids);
  return docs.map((d) => denormalizePayslip(d, userNames));
}

async function denormalizeOne(doc: PayslipDoc): Promise<PayslipResponseShape> {
  const userNames = await buildUserNamesMap([doc.userId, doc.generatedById]);
  return denormalizePayslip(doc, userNames);
}

export interface ListMyInput {
  month?: string;
  page?: number;
  limit?: number;
}

export interface ListAllInput extends ListMyInput {
  userId?: string;
}

export interface PagedPayslips {
  items: PayslipResponseShape[];
  total: number;
  page: number;
  limit: number;
}

export async function listMyPayslips(
  userId: string,
  input: ListMyInput,
): Promise<PagedPayslips> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (input.month) filter.month = input.month;
  const [docs, total] = await Promise.all([
    Payslip.find(filter)
      .sort({ month: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payslip.countDocuments(filter),
  ]);
  const items = await denormalizeMany(docs);
  return { items, total, page, limit };
}

export async function listAllPayslips(input: ListAllInput): Promise<PagedPayslips> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (input.month) filter.month = input.month;
  if (input.userId) filter.userId = new Types.ObjectId(input.userId);
  const [docs, total] = await Promise.all([
    Payslip.find(filter)
      .sort({ month: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payslip.countDocuments(filter),
  ]);
  const items = await denormalizeMany(docs);
  return { items, total, page, limit };
}

export async function getPayslip(
  id: string,
  requester: Requester,
): Promise<PayslipResponseShape> {
  const doc = await Payslip.findById(id);
  if (!doc) throw new NotFoundError("Payslip");
  if (!isElevated(requester.role) && doc.userId.toString() !== requester.id) {
    throw new ForbiddenError();
  }
  return denormalizeOne(doc);
}

export interface CreatePayslipInput {
  userId: string;
  month: string;
  currency?: string;
  gross: number;
  breakdown?: BreakdownItem[];
  notes?: string;
}

async function notifyPayslipAvailable(userId: string, month: string): Promise<void> {
  const { notify } = await import("../notifications/notifications.service.js");
  await notify(userId, {
    kind: "PAYSLIP_AVAILABLE",
    title: `Payslip available for ${month}`,
    link: "/payroll",
  });
}

/**
 * Send the freshly-generated payslip PDF to the employee's email. Best-effort
 * — never throws; failures are logged so the payslip itself isn't rolled
 * back if SMTP is down. The PDF buffer is computed server-side using the
 * same generator the on-demand /payslips/:id/pdf route uses, so the email
 * attachment matches the downloadable file byte-for-byte.
 */
async function emailPayslipToEmployee(
  payslip: PayslipDoc,
): Promise<void> {
  try {
    const employee = await User.findById(payslip.userId)
      .select("name email jobTitle")
      .lean<Pick<UserDoc, "name" | "email" | "jobTitle">>();
    if (!employee || !employee.email) {
      logger.warn(
        { userId: payslip.userId.toString(), month: payslip.month },
        "payroll.emailPayslipToEmployee — no email on user; skipping",
      );
      return;
    }

    // Resolve admin contact for the payslip footer (same fallback the
    // on-demand PDF route uses — generator → any active admin).
    type ContactSource = {
      name: string;
      email: string;
      phone?: string | null;
      role?: string;
      isActive?: boolean;
    };
    let contact: ContactSource | null = (await User.findById(payslip.generatedById)
      .select("name email phone role isActive")
      .lean()) as ContactSource | null;
    if (!contact || !contact.isActive || contact.role !== "ADMIN") {
      contact = (await User.findOne({ role: "ADMIN", isActive: true })
        .select("name email phone")
        .lean()) as ContactSource | null;
    }

    const buffer = await generatePayslipPdf(payslip, employee, {
      adminName: contact?.name ?? null,
      adminPhone: contact?.phone ?? null,
      adminEmail: contact?.email ?? null,
    });

    const subject = `Payslip · ${payslip.month}`;
    const netLabel = formatCurrency(payslip.netAmount, payslip.currency);
    const text = [
      `Hi ${employee.name},`,
      "",
      `Your payslip for ${payslip.month} is attached as a PDF.`,
      `Net amount: ${netLabel}`,
      "",
      "Any questions on the breakdown — reply to this email and we'll come back to you.",
      "",
      "— Global NeoChain Solutions",
    ].join("\n");

    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1f2937;">
  <p>Hi ${employee.name},</p>
  <p>Your payslip for <strong>${payslip.month}</strong> is attached as a PDF.</p>
  <p style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-radius:8px;">
    Net amount: <strong>${netLabel}</strong>
  </p>
  <p>Any questions on the breakdown — reply to this email and we'll come back to you.</p>
  <p style="margin-top:20px;color:#6b7280;font-size:12px;">— Global NeoChain Solutions</p>
</div>`.trim();

    await getMailDriver().send({
      to: employee.email,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `payslip-${payslip.month}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });

    logger.info(
      {
        userId: payslip.userId.toString(),
        month: payslip.month,
        to: employee.email,
      },
      "payroll: payslip emailed to employee",
    );
  } catch (err) {
    logger.warn(
      { err, userId: payslip.userId.toString(), month: payslip.month },
      "payroll.emailPayslipToEmployee failed (best-effort)",
    );
  }
}

/**
 * Compute the net payslip amount.
 *
 * CONTRACT (gross convention):
 *   `gross` is the *base salary before earnings/deductions* — i.e. the
 *   raw monthly salary stored on the user/contract. Earnings (bonus,
 *   reimbursements, allowances) are added on top via `breakdown`, and
 *   deductions (tax, PF, advances) are subtracted. So:
 *
 *     net = gross + Σ(EARNING items) − Σ(DEDUCTION items)
 *
 *   Callers MUST NOT pre-fold earnings into `gross`. If you have a
 *   bonus or allowance, pass it as a `BreakdownItem` with kind="EARNING".
 *
 * All amounts are integer minor units (paise/cents). The `Math.round` at
 * the end is defensive — a stray fraction from a future caller would
 * otherwise persist as a wrong cent in the DB.
 */
function computeNet(gross: number, breakdown: BreakdownItem[]): number {
  let net = gross;
  for (const item of breakdown) {
    if (item.kind === "EARNING") net += item.amount;
    else if (item.kind === "DEDUCTION") net -= item.amount;
  }
  return Math.round(net);
}

export async function createPayslip(
  input: CreatePayslipInput,
  generatedById: string,
): Promise<PayslipResponseShape> {
  if (input.gross < 0) {
    throw new ValidationError("gross must be >= 0");
  }
  // Integer-money guard: gross + each breakdown amount must be non-negative
  // integer minor units. Rejects fractional cents at the service boundary.
  assertIntegerMoney(input.gross, "gross");
  const breakdown = input.breakdown ?? [];
  for (const [i, item] of breakdown.entries()) {
    assertIntegerMoney(item.amount, `breakdown[${i}].amount`);
  }
  const netAmount = computeNet(input.gross, breakdown);
  if (netAmount < 0) {
    throw new ValidationError("netAmount cannot be negative");
  }
  assertIntegerMoney(netAmount, "netAmount");
  // Make sure target user exists
  const target = await User.findById(input.userId).select("_id");
  if (!target) throw new NotFoundError("User");

  const userObjectId = new Types.ObjectId(input.userId);
  const generatedByObjectId = new Types.ObjectId(generatedById);
  const currency = input.currency ?? "INR";
  const now = new Date();
  // Snapshot the FX rate at write time so historical aggregations don't
  // silently re-rate when prod swaps in a real FX provider.
  const fxRateInrAtCreate = getInrRateAt(currency, now);

  const payslipPayload = {
    userId: userObjectId,
    month: input.month,
    currency,
    gross: input.gross,
    breakdown,
    netAmount,
    notes: input.notes ?? null,
    generatedById: generatedByObjectId,
    pdfUrl: null,
    fxRateInrAtCreate,
  };

  const expensePayload = {
    userId: userObjectId,
    amount: netAmount,
    currency,
    category: "SALARY" as const,
    description: `Salary for ${input.month}`,
    incurredOn: now,
    status: "APPROVED" as const,
    decisionById: generatedByObjectId,
    decisionNote: "Auto-generated from payroll",
    decidedAt: now,
    fxRateInrAtCreate,
  };

  // Detect "transactions not supported" errors from a single-node Mongo so
  // dev/test environments can still run the create un-transactionally.
  const isTransactionUnsupportedError = (err: unknown): boolean => {
    const e = err as { code?: number; codeName?: string; message?: string };
    if (e.codeName === "IllegalOperation") return true;
    if (typeof e.message === "string") {
      const m = e.message;
      if (m.includes("Transaction numbers are only allowed")) return true;
      if (m.includes("replica set")) return true;
      if (m.includes("not supported")) return true;
    }
    return false;
  };

  let created: PayslipDoc | null = null;
  let session: mongoose.ClientSession | null = null;

  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const docs = await Payslip.create([payslipPayload], { session });
      created = (docs[0] ?? null) as PayslipDoc | null;

      // Idempotency guard: don't create a second mirror if one already
      // exists for this user+month. The model agent owns the unique
      // index — until that lands, this read-then-write is the best we
      // can do, and it's safe inside a transaction.
      const existingMirror = await Expense.exists(
        {
          userId: userObjectId,
          category: "SALARY",
          // Match by description since the model doesn't expose a `month`
          // field; the description includes the month string we wrote.
          description: `Salary for ${input.month}`,
        },
        // exists() typings don't take session in older mongoose; cast.
      ).session(session);

      if (!existingMirror) {
        await Expense.create([expensePayload], { session });
      } else {
        logger.info(
          { userId: input.userId, month: input.month },
          "payroll.createPayslip skipping mirror — salary expense already exists",
        );
      }
    });
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) {
      throw new ConflictError("Payslip already exists for this month");
    }
    if (!isTransactionUnsupportedError(err)) {
      throw err;
    }

    // Fall back to un-transactional path for single-node dev Mongo.
    logger.warn(
      { userId: input.userId, month: input.month },
      "payroll.createPayslip transactions unsupported — falling back to un-transactional create",
    );
    try {
      created = await Payslip.create(payslipPayload);
    } catch (createErr) {
      const ce = createErr as { code?: number };
      if (ce.code === 11000) {
        throw new ConflictError("Payslip already exists for this month");
      }
      throw createErr;
    }

    // Idempotency check before mirror create.
    const existingMirror = await Expense.exists({
      userId: userObjectId,
      category: "SALARY",
      description: `Salary for ${input.month}`,
    });
    if (!existingMirror) {
      try {
        await Expense.create(expensePayload);
      } catch (mirrorErr) {
        logger.warn(
          { err: mirrorErr, userId: input.userId, month: input.month },
          "payroll.createPayslip salary-expense mirror failed (un-transactional fallback)",
        );
      }
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }

  if (!created) {
    // Defensive: should be unreachable since both branches assign or throw.
    throw new Error("payroll.createPayslip: payslip not created");
  }

  void notifyPayslipAvailable(input.userId, input.month).catch((err) => {
    logger.warn({ err }, "payroll.createPayslip notify failed");
  });
  // Fire-and-forget: send the PDF as an attachment to the employee's
  // mailbox. Wrapped in `void` so we don't block the API response on
  // SMTP latency, and `emailPayslipToEmployee` never throws.
  void emailPayslipToEmployee(created);
  return denormalizeOne(created);
}

export interface PayslipPdfResult {
  buffer: Buffer;
  filename: string;
}

export async function getOrGeneratePdf(
  payslipId: string,
  requester: Requester,
): Promise<PayslipPdfResult> {
  const doc = await Payslip.findById(payslipId).select("+pdfKey");
  if (!doc) throw new NotFoundError("Payslip");
  if (!isElevated(requester.role) && doc.userId.toString() !== requester.id) {
    throw new ForbiddenError();
  }
  const employee = (await User.findById(doc.userId).select(
    "name email jobTitle",
  )) as Pick<UserDoc, "name" | "email" | "jobTitle"> | null;
  if (!employee) throw new NotFoundError("Employee");

  // The footer of every payslip surfaces the admin who can answer queries
  // about it. Prefer the admin who actually generated this payslip; fall
  // back to any active admin if the generator account is no longer present.
  type ContactSource = {
    name: string;
    email: string;
    phone?: string | null;
    role?: string;
    isActive?: boolean;
  };
  let contactSource: ContactSource | null = (await User.findById(doc.generatedById)
    .select("name email phone role isActive")
    .lean()) as ContactSource | null;
  if (!contactSource || !contactSource.isActive || contactSource.role !== "ADMIN") {
    contactSource = (await User.findOne({
      role: "ADMIN",
      isActive: true,
    })
      .select("name email phone")
      .lean()) as ContactSource | null;
  }

  // For MVP we regenerate every time, but persist key+url for reference.
  const buffer = await generatePayslipPdf(doc, employee, {
    adminName: contactSource?.name ?? null,
    adminPhone: contactSource?.phone ?? null,
    adminEmail: contactSource?.email ?? null,
  });

  // Attempt to persist a cached copy in storage. If storage is unavailable this
  // shouldn't fail the request — we still return the freshly-generated buffer.
  try {
    if (doc.pdfKey) {
      try {
        await storage.delete(doc.pdfKey);
      } catch {
        // best-effort cleanup
      }
    }
    const saved = await storage.save("payslip", doc.userId.toString(), {
      originalName: `payslip-${doc.month}.pdf`,
      mimeType: "application/pdf",
      buffer,
    });
    doc.pdfKey = saved.key;
    doc.pdfUrl = saved.url;
    await doc.save();
  } catch {
    // Persistence is best-effort — never block the download.
  }

  return {
    buffer,
    filename: `payslip-${doc.month}.pdf`,
  };
}
