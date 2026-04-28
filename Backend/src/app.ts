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
import { healthRouter } from "./modules/health/health.routes.js";
import { employeesRouter, positionsRouter } from "./modules/employees/employees.routes.js";
import { departmentsRouter } from "./modules/departments/departments.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { projectsRouter, tasksRouter } from "./modules/tasks/tasks.routes.js";
import { expensesRouter } from "./modules/expenses/expenses.routes.js";
import { payrollRouter } from "./modules/payroll/payroll.routes.js";
import "./modules/auth/auth.schema.js";
import "./modules/employees/employees.schema.js";
import "./modules/departments/departments.schema.js";
import "./modules/attendance/attendance.schema.js";
import "./modules/tasks/tasks.schema.js";
import "./modules/expenses/expenses.schema.js";
import "./modules/payroll/payroll.schema.js";
import { buildOpenApiDocument } from "./openapi/spec.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(globalLimiter);

  // Static file serving for uploaded avatars/resumes
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? "uploads");
  app.use("/files", express.static(uploadsDir, { fallthrough: false }));

  const openapi = buildOpenApiDocument();
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/employees", employeesRouter);
  app.use("/positions", positionsRouter);
  app.use("/departments", departmentsRouter);
  app.use("/attendance", attendanceRouter);
  app.use("/projects", projectsRouter);
  app.use("/tasks", tasksRouter);
  app.use("/expenses", expensesRouter);
  app.use("/payroll", payrollRouter);

  app.use(errorHandler);
  return app;
}
