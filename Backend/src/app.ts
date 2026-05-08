import express from "express";
import path from "node:path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { authExtensionsRouter } from "./modules/authExtensions/authExtensions.routes.js";
import { registrationRouter } from "./modules/registration/registration.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { employeesRouter, positionsRouter } from "./modules/employees/employees.routes.js";
import { departmentsRouter } from "./modules/departments/departments.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { projectsRouter, tasksRouter } from "./modules/tasks/tasks.routes.js";
import { expensesRouter } from "./modules/expenses/expenses.routes.js";
import { payrollRouter } from "./modules/payroll/payroll.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { callsRouter } from "./modules/calls/calls.routes.js";
import { bugsRouter } from "./modules/bugs/bugs.routes.js";
import { feedbackRouter } from "./modules/feedback/feedback.routes.js";
import { calendarRouter } from "./modules/calendar/calendar.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { contactRouter } from "./modules/contact/contact.routes.js";
import "./modules/auth/auth.schema.js";
import "./modules/authExtensions/authExtensions.schema.js";
import "./modules/registration/registration.schema.js";
import "./modules/employees/employees.schema.js";
import "./modules/departments/departments.schema.js";
import "./modules/attendance/attendance.schema.js";
import "./modules/tasks/tasks.schema.js";
import "./modules/expenses/expenses.schema.js";
import "./modules/payroll/payroll.schema.js";
import "./modules/chat/chat.schema.js";
import "./modules/calls/calls.schema.js";
import "./modules/bugs/bugs.schema.js";
import "./modules/feedback/feedback.schema.js";
import "./modules/calendar/calendar.schema.js";
import "./modules/dashboard/dashboard.schema.js";
import "./modules/notifications/notifications.schema.js";
import "./modules/contact/contact.schema.js";
import { buildOpenApiDocument } from "./openapi/spec.js";

export function createApp() {
  const app = express();

  // Honor X-Forwarded-For exactly one hop when running behind a reverse
  // proxy / load balancer (set TRUST_PROXY=1 in that env). Without this,
  // express-rate-limit keys every request by the proxy IP and effectively
  // shares one bucket across all clients.
  const trustProxy = process.env.TRUST_PROXY;
  app.set("trust proxy", trustProxy ? 1 : false);

  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(globalLimiter);

  // Static file serving for uploaded avatars/resumes/bug screenshots/etc.
  // We explicitly stamp `Cross-Origin-Resource-Policy: cross-origin` here
  // because Helmet's app-wide default is `same-origin`, which blocks the
  // frontend (different origin in dev) from rendering <img src> against
  // these URLs. Inline /files/* assets are public-by-URL anyway.
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? "uploads");
  app.use(
    "/files",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(uploadsDir, { fallthrough: false }),
  );

  const openapi = buildOpenApiDocument();
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  // Auth-extensions (password reset, force-change, TOTP 2FA) live under the
  // same /auth prefix; Express dispatches by path so they don't collide.
  app.use("/auth", authExtensionsRouter);
  // Public self-registration + status lookup. Mounted under /auth so the
  // entire authentication surface lives in one place from a routing pov.
  app.use("/auth", registrationRouter);
  app.use("/employees", employeesRouter);
  app.use("/positions", positionsRouter);
  app.use("/departments", departmentsRouter);
  app.use("/attendance", attendanceRouter);
  app.use("/projects", projectsRouter);
  app.use("/tasks", tasksRouter);
  app.use("/expenses", expensesRouter);
  app.use("/payroll", payrollRouter);
  app.use("/chat", chatRouter);
  app.use("/calls", callsRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/bugs", bugsRouter);
  app.use("/feedback", feedbackRouter);
  app.use("/calendar", calendarRouter);
  // Public contact-form endpoint — unauthenticated. Has its own tight rate
  // limit inside the router (5/15min/IP) and a honeypot field.
  app.use("/contact", contactRouter);

  app.use(errorHandler);
  return app;
}
