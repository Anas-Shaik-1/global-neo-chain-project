import { logger } from "../../lib/logger.js";
import { fireDueReminders } from "./calendar.service.js";

const TICK_MS = 60_000; // every minute

interface SchedulerHandle {
  stop: () => void;
}

/**
 * Background tick that fans out CALENDAR_REMINDER notifications when an
 * event/reminder's `start - reminderMinutesBefore` instant has arrived. A
 * one-minute cadence is plenty for reminder granularity (calendar tools
 * universally round to the minute), and `reminderFiredAt` makes each row
 * single-shot so a missed tick during a deploy doesn't double-fire on the
 * next tick.
 */
export function startCalendarScheduler(): SchedulerHandle {
  const tick = async () => {
    try {
      await fireDueReminders();
    } catch (err) {
      logger.warn({ err }, "calendar scheduler tick error");
    }
  };
  void tick();
  const handle = setInterval(() => void tick(), TICK_MS);
  return { stop: () => clearInterval(handle) };
}
