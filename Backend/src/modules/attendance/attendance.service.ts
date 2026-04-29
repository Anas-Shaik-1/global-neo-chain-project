import { Types } from "mongoose";
import { Attendance, type AttendanceDoc } from "../../models/attendance.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

export interface AttendanceEntryResponse {
  id: string;
  userId: string;
  date: string;
  clockIn: Date;
  clockOut: Date | null;
  lunchStart: Date | null;
  lunchEnd: Date | null;
  lunchMinutes: number;
  durationMinutes: number | null;
  isRemote: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface MonthSummary {
  entries: AttendanceEntryResponse[];
  totalMinutes: number;
  daysWorked: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function todayUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeDuration(entry: {
  clockIn: Date;
  clockOut: Date | null;
  lunchStart: Date | null;
  lunchEnd: Date | null;
}): { durationMinutes: number | null; lunchMinutes: number } {
  let lunchMinutes = 0;
  if (entry.lunchStart && entry.lunchEnd) {
    const lunchDiff = entry.lunchEnd.getTime() - entry.lunchStart.getTime();
    lunchMinutes = lunchDiff > 0 ? Math.floor(lunchDiff / 60000) : 0;
  }
  if (!entry.clockOut) {
    return { durationMinutes: null, lunchMinutes };
  }
  const diffMs = entry.clockOut.getTime() - entry.clockIn.getTime();
  const grossMinutes = diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
  const net = grossMinutes - lunchMinutes;
  return { durationMinutes: net < 0 ? 0 : net, lunchMinutes };
}

function toResponse(doc: AttendanceDoc): AttendanceEntryResponse {
  const t = doc as unknown as { createdAt: Date };
  const lunchStart = doc.lunchStart ?? null;
  const lunchEnd = doc.lunchEnd ?? null;
  const clockOut = doc.clockOut ?? null;
  const { durationMinutes, lunchMinutes } = computeDuration({
    clockIn: doc.clockIn,
    clockOut,
    lunchStart,
    lunchEnd,
  });
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    clockIn: doc.clockIn,
    clockOut,
    lunchStart,
    lunchEnd,
    lunchMinutes,
    durationMinutes,
    isRemote: !!doc.isRemote,
    notes: doc.notes ?? null,
    createdAt: t.createdAt,
  };
}

export async function clockIn(
  userId: string,
  input: { notes?: string; isRemote?: boolean } = {},
): Promise<AttendanceEntryResponse> {
  const now = new Date();
  const date = todayUtc(now);
  const existing = await Attendance.findOne({
    userId: new Types.ObjectId(userId),
    date,
  });
  if (existing) {
    throw new ConflictError("Already clocked in today");
  }
  try {
    const created = await Attendance.create({
      userId: new Types.ObjectId(userId),
      date,
      clockIn: now,
      clockOut: null,
      lunchStart: null,
      lunchEnd: null,
      isRemote: input.isRemote ?? false,
      notes: input.notes ?? null,
    });
    return toResponse(created);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Already clocked in today");
    }
    throw err;
  }
}

export async function clockOut(
  userId: string,
  notes?: string,
): Promise<AttendanceEntryResponse> {
  const now = new Date();
  const date = todayUtc(now);
  const entry = await Attendance.findOne({
    userId: new Types.ObjectId(userId),
    date,
  });
  if (!entry) {
    throw new NotFoundError("No clock-in today");
  }
  if (entry.clockOut) {
    throw new ConflictError("Already clocked out today");
  }
  if (Date.now() - entry.clockIn.getTime() < ONE_HOUR_MS) {
    throw new ConflictError(
      "You can only clock out at least 1 hour after clock-in",
    );
  }
  entry.clockOut = now;
  if (notes !== undefined) {
    entry.notes = notes;
  }
  await entry.save();
  return toResponse(entry);
}

export async function startLunch(userId: string): Promise<AttendanceEntryResponse> {
  const now = new Date();
  const date = todayUtc(now);
  const entry = await Attendance.findOne({
    userId: new Types.ObjectId(userId),
    date,
  });
  if (!entry) {
    throw new NotFoundError("No clock-in today");
  }
  if (entry.clockOut) {
    throw new ConflictError("Already clocked out today");
  }
  if (entry.lunchStart) {
    throw new ConflictError("Lunch already started");
  }
  entry.lunchStart = now;
  await entry.save();
  return toResponse(entry);
}

export async function endLunch(userId: string): Promise<AttendanceEntryResponse> {
  const now = new Date();
  const date = todayUtc(now);
  const entry = await Attendance.findOne({
    userId: new Types.ObjectId(userId),
    date,
  });
  if (!entry) {
    throw new NotFoundError("No clock-in today");
  }
  if (!entry.lunchStart) {
    throw new ConflictError("Lunch not started");
  }
  if (entry.lunchEnd) {
    throw new ConflictError("Lunch already ended");
  }
  entry.lunchEnd = now;
  await entry.save();
  return toResponse(entry);
}

export async function myMonth(
  userId: string,
  monthStr?: string,
): Promise<MonthSummary> {
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = monthStr ?? defaultMonth;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new NotFoundError("Invalid month");
  }
  const entries = await Attendance.find({
    userId: new Types.ObjectId(userId),
    date: { $regex: `^${month}` },
  }).sort({ date: 1, clockIn: 1 });

  let totalMinutes = 0;
  let daysWorked = 0;
  for (const e of entries) {
    if (e.clockOut) {
      const { durationMinutes } = computeDuration({
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        lunchStart: e.lunchStart ?? null,
        lunchEnd: e.lunchEnd ?? null,
      });
      if (durationMinutes !== null) totalMinutes += durationMinutes;
      daysWorked += 1;
    }
  }

  return {
    entries: entries.map(toResponse),
    totalMinutes,
    daysWorked,
  };
}
