import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./db/index.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { attachSocketServer } from "./realtime/index.js";
import { startAttendanceScheduler } from "./modules/attendance/attendance.jobs.js";
import { startCalendarScheduler } from "./modules/calendar/calendar.jobs.js";

const SHUTDOWN_GRACE_MS = 10_000;

async function main() {
  await connectDb();
  const app = createApp();
  const http = createServer(app);
  const io = attachSocketServer(http);
  http.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, `EMS backend listening`);
    logger.info(`Swagger: http://localhost:${config.PORT}/docs`);
  });

  // Background scheduler: 10AM check-in reminders + 12AM auto-checkout for
  // any attendance entries left open the prior day. Cancellation handle is
  // tracked so the SIGTERM path can stop it cleanly.
  const attendance = startAttendanceScheduler();
  // Per-minute calendar reminder fanout. Cancellation handle is bundled
  // into the same shutdown path so SIGTERM stops both.
  const calendar = startCalendarScheduler();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutdown initiated");

    // Stop background timers first so they don't fire mid-shutdown.
    attendance.stop();
    calendar.stop();

    // Stop accepting new HTTP connections; in-flight requests still complete.
    http.close((err) => {
      if (err) logger.warn({ err }, "http.close error");
    });

    // Disconnect socket.io clients so they reconnect to a healthy instance.
    try {
      io.disconnectSockets(true);
      await io.close();
    } catch (err) {
      logger.warn({ err }, "io.close error");
    }

    try {
      await disconnectDb();
    } catch (err) {
      logger.warn({ err }, "mongo disconnect error");
    }

    logger.info("shutdown complete");
    process.exit(0);
  };

  // Hard cutoff: if shutdown drags past SHUTDOWN_GRACE_MS the orchestrator's
  // SIGKILL is imminent — exit on our own so logs flush cleanly.
  const installSignal = (sig: NodeJS.Signals) => {
    process.on(sig, () => {
      void shutdown(sig);
      setTimeout(() => {
        logger.error("shutdown grace exceeded, forcing exit");
        process.exit(1);
      }, SHUTDOWN_GRACE_MS).unref();
    });
  };
  installSignal("SIGTERM");
  installSignal("SIGINT");
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
