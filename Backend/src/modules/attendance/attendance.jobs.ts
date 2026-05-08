import { Types } from "mongoose";
import { Attendance } from "../../models/attendance.model.js";
import { User } from "../../models/user.model.js";
import { logger } from "../../lib/logger.js";

const MS_PER_MINUTE = 60_000;
const REMINDER_HOUR = 10; // 10:00 local-server time
const AUTO_CHECKOUT_HOUR = 0; // 00:00 (midnight) closes prior day

function todayUtc(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function endOfDayUtc(dateStr: string): Date {
  // dateStr is YYYY-MM-DD; produce 23:59:59.999 UTC of that day.
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

/**
 * Forces clockOut on any attendance entry whose `date` is in the past and
 * still has `clockOut: null`. The auto clockOut is the end of that calendar
 * day (UTC), so duration math is correct regardless of when the cleanup
 * actually runs. Each affected employee receives a notification so the
 * adjustment is visible.
 */
export async function autoCloseStaleAttendance(): Promise<{ closed: number }> {
  const today = todayUtc();
  // Only entries strictly before today; the current day might still be open.
  const stale = await Attendance.find({
    date: { $lt: today },
    clockOut: null,
  }).select("_id userId date");
  if (stale.length === 0) return { closed: 0 };

  const { notify } = await import("../notifications/notifications.service.js");
  let closed = 0;
  for (const entry of stale) {
    try {
      const eod = endOfDayUtc(entry.date);
      await Attendance.updateOne(
        { _id: entry._id, clockOut: null },
        { $set: { clockOut: eod, notes: "Auto-closed at end of day" } },
      );
      closed += 1;
      void notify(entry.userId.toString(), {
        kind: "ATTENDANCE_AUTO_CHECKOUT",
        title: `Auto-checked out for ${entry.date}`,
        body: "We closed yesterday's attendance at end of day. Adjust the timing on the attendance page if it's wrong.",
        link: "/attendance",
      }).catch(() => undefined);
    } catch (err) {
      logger.warn(
        { err, entryId: entry._id.toString() },
        "auto-close attendance: per-entry update failed",
      );
    }
  }
  logger.info({ closed }, "attendance: auto-close pass complete");
  return { closed };
}

/**
 * Notify any active employee who hasn't clocked in yet today. Runs once a
 * day at REMINDER_HOUR local-server time. Best-effort: failures per user
 * are logged but never abort the whole sweep.
 */
export async function sendCheckInReminders(): Promise<{ pinged: number }> {
  const today = todayUtc();
  const active = await User.find({
    isActive: true,
    approvalStatus: "ACTIVE",
    role: { $in: ["EMPLOYEE", "HR", "ADMIN"] },
  })
    .select("_id")
    .lean();
  if (active.length === 0) return { pinged: 0 };

  const ids = active.map((u) => u._id);
  const clockedInDocs = await Attendance.find({
    userId: { $in: ids },
    date: today,
  })
    .select("userId")
    .lean();
  const clockedIn = new Set(clockedInDocs.map((d) => d.userId.toString()));

  const targets = ids
    .map((id) => id.toString())
    .filter((id) => !clockedIn.has(id));
  if (targets.length === 0) return { pinged: 0 };

  const { notifyMany } = await import(
    "../notifications/notifications.service.js"
  );
  await notifyMany(targets, {
    kind: "ATTENDANCE_REMINDER",
    title: "Time to clock in",
    body: "Don't forget to mark your attendance for today.",
    link: "/attendance",
  });
  logger.info({ pinged: targets.length }, "attendance: reminder fanout sent");
  return { pinged: targets.length };
}

interface SchedulerHandle {
  stop: () => void;
}

/**
 * Boots the attendance background scheduler. Two ticks:
 *
 *   • Hourly tick: at the top of each hour, if it's REMINDER_HOUR send the
 *     check-in reminders, and if it's AUTO_CHECKOUT_HOUR close stale entries.
 *     One tick per hour means we miss at most an hour after deploy/restart,
 *     which is acceptable for both jobs.
 *
 * Returns a handle whose `stop()` cancels the timers — callers should invoke
 * it during graceful shutdown.
 */
export function startAttendanceScheduler(): SchedulerHandle {
  let lastDayClosedFor: string | null = null;
  let lastDayPingedFor: string | null = null;

  // Run a check on a 1-minute cadence so the first hour after boot also
  // fires whichever job is due, and so a clock skew of a few seconds doesn't
  // cause the hour transition to be missed.
  const tick = async () => {
    try {
      const now = new Date();
      const hour = now.getUTCHours();
      const today = todayUtc(now);

      if (hour === AUTO_CHECKOUT_HOUR && lastDayClosedFor !== today) {
        lastDayClosedFor = today;
        void autoCloseStaleAttendance().catch((err) =>
          logger.warn({ err }, "autoCloseStaleAttendance failed"),
        );
      }

      if (hour === REMINDER_HOUR && lastDayPingedFor !== today) {
        lastDayPingedFor = today;
        void sendCheckInReminders().catch((err) =>
          logger.warn({ err }, "sendCheckInReminders failed"),
        );
      }

      void hour;
    } catch (err) {
      logger.warn({ err }, "attendance scheduler tick error");
    }
  };

  // Run once at boot (covers process restart inside an active hour) and
  // then every minute.
  void tick();
  const handle = setInterval(() => void tick(), MS_PER_MINUTE);
  return {
    stop: () => clearInterval(handle),
  };
}
