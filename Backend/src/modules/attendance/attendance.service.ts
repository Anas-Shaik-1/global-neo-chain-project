import { Types } from "mongoose";
import { Attendance, type AttendanceDoc } from "../../models/attendance.model.js";
import { User } from "../../models/user.model.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { config } from "../../config/index.js";

// Great-circle distance between two WGS84 points in metres. Standard
// haversine; precise to a few metres at typical geofence scales (~200m),
// which is well below the accuracy floor of a phone's GPS chip.
function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

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
  isAbsent: boolean;
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
  const isAbsent = !!doc.isAbsent;
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    clockIn: doc.clockIn,
    clockOut,
    lunchStart,
    lunchEnd,
    lunchMinutes,
    durationMinutes: isAbsent ? 0 : durationMinutes,
    isRemote: !!doc.isRemote,
    isAbsent,
    notes: doc.notes ?? null,
    createdAt: t.createdAt,
  };
}

function midnightUtcOf(dateStr: string): Date {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return new Date(Date.UTC(
    Number.isFinite(y) ? y : 1970,
    (Number.isFinite(m) ? m : 1) - 1,
    Number.isFinite(d) ? d : 1,
    0,
    0,
    0,
    0,
  ));
}

export interface ClockInInput {
  notes?: string;
  isRemote?: boolean;
  latitude?: number;
  longitude?: number;
}

export async function clockIn(
  userId: string,
  input: ClockInInput = {},
): Promise<AttendanceEntryResponse> {
  // Geofence enforcement. Only kicks in when both office coordinates are
  // configured AND the caller hasn't declared a remote clock-in. Remote
  // workers bypass entirely (they're working from elsewhere by definition).
  const officeLat = config.OFFICE_LATITUDE;
  const officeLng = config.OFFICE_LONGITUDE;
  const geofenceEnabled = officeLat !== undefined && officeLng !== undefined;
  const isRemote = input.isRemote ?? false;
  if (geofenceEnabled && !isRemote) {
    if (input.latitude === undefined || input.longitude === undefined) {
      throw new ValidationError(
        "Location is required to clock in. Allow location access or switch to remote.",
      );
    }
    const distance = haversineMetres(
      input.latitude,
      input.longitude,
      officeLat,
      officeLng,
    );
    if (distance > config.OFFICE_GEOFENCE_RADIUS_M) {
      throw new ForbiddenError(
        `You must be at the office to clock in. You are ${Math.round(
          distance,
        )}m away (limit ${config.OFFICE_GEOFENCE_RADIUS_M}m).`,
      );
    }
  }

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
      isRemote,
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
  // Manual clock-out is intentionally unrestricted — employees own their
  // own time. The previous "1h minimum" guard was dropped because it forced
  // users to fake the clock when they had a short shift or wanted to undo
  // a stray clock-in. The auto-midnight closer still keeps stale entries
  // from lingering forever.
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

export interface AdminEditAttendanceInput {
  clockIn?: Date;
  clockOut?: Date | null;
  lunchStart?: Date | null;
  lunchEnd?: Date | null;
  isRemote?: boolean;
  isAbsent?: boolean;
  notes?: string | null;
  reason?: string;
}

/**
 * Admin amendment: rewrite any combination of timestamps / flags / notes on
 * an existing attendance entry. Validates basic ordering (clockOut after
 * clockIn, lunch inside the work window), and notifies the affected employee
 * with kind=ATTENDANCE_EDITED so they see the change in their feed.
 *
 * The `editorId` is recorded in the change notification so the employee can
 * see who made the change. Caller (controller) is responsible for the role
 * check; this function trusts that it's been gated.
 */
export async function editEntryAsAdmin(
  entryId: string,
  editorId: string,
  input: AdminEditAttendanceInput,
): Promise<AttendanceEntryResponse> {
  if (!Types.ObjectId.isValid(entryId)) {
    throw new NotFoundError("Attendance");
  }
  const entry = await Attendance.findById(entryId);
  if (!entry) throw new NotFoundError("Attendance");

  const fieldsTouched: string[] = [];

  // isAbsent has special semantics: setting it to true overrides every
  // other timing (resets to date-midnight, clears lunch, drops remote).
  // Setting it to false simply clears the flag — the admin is then expected
  // to provide fresh clockIn/clockOut in the same patch (validated below).
  if (input.isAbsent === true) {
    const midnight = midnightUtcOf(entry.date);
    entry.isAbsent = true;
    entry.clockIn = midnight;
    entry.clockOut = midnight;
    entry.lunchStart = null;
    entry.lunchEnd = null;
    entry.isRemote = false;
    fieldsTouched.push("isAbsent");
  } else {
    if (input.isAbsent === false) {
      entry.isAbsent = false;
      fieldsTouched.push("isAbsent");
    }
    if (input.clockIn !== undefined) {
      entry.clockIn = input.clockIn;
      fieldsTouched.push("clockIn");
    }
    if (input.clockOut !== undefined) {
      entry.clockOut = input.clockOut;
      fieldsTouched.push("clockOut");
    }
    if (input.lunchStart !== undefined) {
      entry.lunchStart = input.lunchStart;
      fieldsTouched.push("lunchStart");
    }
    if (input.lunchEnd !== undefined) {
      entry.lunchEnd = input.lunchEnd;
      fieldsTouched.push("lunchEnd");
    }
    if (input.isRemote !== undefined) {
      entry.isRemote = input.isRemote;
      fieldsTouched.push("isRemote");
    }
  }
  if (input.notes !== undefined) {
    entry.notes = input.notes;
    fieldsTouched.push("notes");
  }
  if (fieldsTouched.length === 0) {
    throw new ValidationError("No editable fields supplied");
  }

  // Ordering sanity: clockOut must be strictly after clockIn; lunch (if set)
  // must sit inside the worked window. Soft validation — we treat invalid
  // combos as 400 rather than letting them produce nonsense durations.
  // Absent entries collapse all timestamps to midnight by design — skip the
  // ordering check for them.
  if (!entry.isAbsent) {
    if (entry.clockOut && entry.clockOut.getTime() <= entry.clockIn.getTime()) {
      throw new ValidationError("clockOut must be after clockIn");
    }
    if (entry.lunchStart && entry.lunchEnd) {
      if (entry.lunchEnd.getTime() <= entry.lunchStart.getTime()) {
        throw new ValidationError("lunchEnd must be after lunchStart");
      }
    }
    if (entry.lunchStart && entry.lunchStart.getTime() < entry.clockIn.getTime()) {
      throw new ValidationError("lunchStart must be after clockIn");
    }
    if (
      entry.lunchEnd &&
      entry.clockOut &&
      entry.lunchEnd.getTime() > entry.clockOut.getTime()
    ) {
      throw new ValidationError("lunchEnd must be before clockOut");
    }
  }

  await entry.save();

  // Notify the employee best-effort. We never abort the edit on notify
  // failure — the audit trail (this function logs the edit) is the source
  // of truth.
  void (async () => {
    try {
      const { notify } = await import(
        "../notifications/notifications.service.js"
      );
      const reason = input.reason?.trim();
      const body = reason
        ? `${reason}`
        : `Fields updated: ${fieldsTouched.join(", ")}.`;
      await notify(entry.userId.toString(), {
        kind: "ATTENDANCE_EDITED",
        title: `Your attendance for ${entry.date} was updated`,
        body,
        link: "/attendance",
      });
    } catch (err) {
      logger.warn(
        { err, entryId, editorId },
        "attendance edit notify failed",
      );
    }
  })();

  logger.info(
    { entryId, editorId, fields: fieldsTouched },
    "attendance entry edited by admin",
  );

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

export interface PresentTodayPerson {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  clockIn: Date;
  isRemote: boolean;
  /** True once the person has also clocked OUT for the day. */
  hasClockedOut: boolean;
}

export interface NotClockedInPerson {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
}

export interface PresentTodaySummary {
  date: string;
  presentCount: number;
  remoteCount: number;
  /** Active employees who are not absent and have not yet clocked in. */
  notClockedInCount: number;
  people: PresentTodayPerson[];
  /** Names + avatars of the not-yet-present employees, for the dashboard
   *  "Awaiting" panel. Sorted alphabetically by display name. */
  notClockedIn: NotClockedInPerson[];
}

/**
 * Snapshot of who is "present" today — anyone with an attendance entry for
 * the current UTC date that isn't marked absent. The list is sorted by
 * clock-in time so early arrivals appear first; the summary counts cover
 * remote-vs-onsite + how many active employees still haven't clocked in
 * (useful for the dashboard widget that nudges late arrivals).
 *
 * Visible to all authenticated users — there's nothing sensitive about
 * "Eli is at work today" and it's the kind of presence info that helps a
 * distributed team coordinate.
 */
export async function presentToday(): Promise<PresentTodaySummary> {
  const today = todayUtc();
  const entries = await Attendance.find({
    date: today,
    isAbsent: { $ne: true },
  })
    .sort({ clockIn: 1 })
    .lean<
      {
        userId: Types.ObjectId;
        clockIn: Date;
        clockOut: Date | null;
        isRemote?: boolean;
      }[]
    >();

  const userIds = entries.map((e) => e.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name jobTitle avatarUrl")
    .lean<
      { _id: Types.ObjectId; name: string; jobTitle?: string | null; avatarUrl?: string | null }[]
    >();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  const people: PresentTodayPerson[] = entries.map((e) => {
    const u = byId.get(e.userId.toString());
    return {
      id: e.userId.toString(),
      name: u?.name ?? "Unknown",
      jobTitle: u?.jobTitle ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      clockIn: e.clockIn,
      isRemote: !!e.isRemote,
      hasClockedOut: !!e.clockOut,
    };
  });

  // Pull the full active roster so we can subtract who's already
  // clocked-in to derive who hasn't. We need names + avatars, so the
  // earlier `countDocuments` is now a real `find` — the cost is one extra
  // query of bounded size (active employees, typically <500).
  const activeRoster = await User.find({
    isActive: true,
    approvalStatus: "ACTIVE",
    role: { $in: ["EMPLOYEE", "HR", "ADMIN"] },
  })
    .select("_id name jobTitle avatarUrl")
    .lean<
      { _id: Types.ObjectId; name: string; jobTitle?: string | null; avatarUrl?: string | null }[]
    >();
  const presentIds = new Set(people.map((p) => p.id));
  const notClockedIn: NotClockedInPerson[] = activeRoster
    .filter((u) => !presentIds.has(u._id.toString()))
    .map((u) => ({
      id: u._id.toString(),
      name: u.name,
      jobTitle: u.jobTitle ?? null,
      avatarUrl: u.avatarUrl ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const remoteCount = people.filter((p) => p.isRemote).length;

  return {
    date: today,
    presentCount: people.length,
    remoteCount,
    notClockedInCount: notClockedIn.length,
    people,
    notClockedIn,
  };
}
