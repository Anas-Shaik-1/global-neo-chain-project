import { Types } from "mongoose";
import {
  Payslip,
  type PayslipDoc,
  type BreakdownKind,
} from "../../models/payslip.model.js";
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

function computeNet(gross: number, breakdown: BreakdownItem[]): number {
  let net = gross;
  for (const item of breakdown) {
    if (item.kind === "EARNING") net += item.amount;
    else if (item.kind === "DEDUCTION") net -= item.amount;
  }
  return net;
}

export async function createPayslip(
  input: CreatePayslipInput,
  generatedById: string,
): Promise<PayslipResponseShape> {
  if (input.gross < 0) {
    throw new ValidationError("gross must be >= 0");
  }
  const breakdown = input.breakdown ?? [];
  const netAmount = computeNet(input.gross, breakdown);
  if (netAmount < 0) {
    throw new ValidationError("netAmount cannot be negative");
  }
  // Make sure target user exists
  const target = await User.findById(input.userId).select("_id");
  if (!target) throw new NotFoundError("User");

  try {
    const created = await Payslip.create({
      userId: new Types.ObjectId(input.userId),
      month: input.month,
      currency: input.currency ?? "USD",
      gross: input.gross,
      breakdown,
      netAmount,
      notes: input.notes ?? null,
      generatedById: new Types.ObjectId(generatedById),
      pdfUrl: null,
    });
    return denormalizeOne(created);
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) {
      throw new ConflictError("Payslip already exists for this month");
    }
    throw err;
  }
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

  // For MVP we regenerate every time, but persist key+url for reference.
  const buffer = await generatePayslipPdf(doc, employee);

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
