import { Types } from "mongoose";
import { Attendance, type AttendanceDoc } from "../../models/attendance.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

export interface AttendanceEntryResponse {
  id: string;
  userId: string;
  date: string;
  clockIn: Date;
  clockOut: Date | null;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface MonthSummary {
  entries: AttendanceEntryResponse[];
  totalMinutes: number;
  daysWorked: number;
}

function todayUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function durationMinutes(clockIn: Date, clockOut: Date | null): number | null {
  if (!clockOut) return null;
  const diffMs = clockOut.getTime() - clockIn.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / 60000);
}

function toResponse(doc: AttendanceDoc): AttendanceEntryResponse {
  const t = doc as unknown as { createdAt: Date };
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    clockIn: doc.clockIn,
    clockOut: doc.clockOut ?? null,
    durationMinutes: durationMinutes(doc.clockIn, doc.clockOut ?? null),
    notes: doc.notes ?? null,
    createdAt: t.createdAt,
  };
}

export async function clockIn(
  userId: string,
  notes?: string,
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
      notes: notes ?? null,
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
  entry.clockOut = now;
  if (notes !== undefined) {
    entry.notes = notes;
  }
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
      const mins = durationMinutes(e.clockIn, e.clockOut);
      if (mins !== null) totalMinutes += mins;
      daysWorked += 1;
    }
  }

  return {
    entries: entries.map(toResponse),
    totalMinutes,
    daysWorked,
  };
}
