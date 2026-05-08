import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { registry } from "../../openapi/registry.js";

export const healthRouter = Router();

const HealthLiveResponse = z
  .object({ status: z.literal("ok") })
  .openapi("HealthLiveResponse");

const HealthReadyResponse = z
  .object({
    status: z.enum(["ok", "degraded"]),
    db: z.enum(["up", "down"]),
  })
  .openapi("HealthReadyResponse");

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["health"],
  summary: "Liveness + readiness combined (back-compat).",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: HealthReadyResponse } } },
    503: { description: "Degraded", content: { "application/json": { schema: HealthReadyResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/health/live",
  tags: ["health"],
  summary: "Process is up.",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: HealthLiveResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/health/ready",
  tags: ["health"],
  summary: "Process is up and dependencies are reachable.",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: HealthReadyResponse } } },
    503: { description: "Degraded", content: { "application/json": { schema: HealthReadyResponse } } },
  },
});

async function isMongoUp(): Promise<boolean> {
  // readyState 1 = connected. Even when connected, a `ping` will fail fast if
  // the network to the primary is broken — important for failover scenarios.
  if (mongoose.connection.readyState !== 1) return false;
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;
    await admin.ping();
    return true;
  } catch {
    return false;
  }
}

healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/ready", async (_req, res) => {
  const up = await isMongoUp();
  if (up) {
    res.json({ status: "ok", db: "up" });
  } else {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

// Back-compat: existing clients (and the README) call `/health` directly.
healthRouter.get("/", async (_req, res) => {
  const up = await isMongoUp();
  if (up) {
    res.json({ status: "ok", db: "up" });
  } else {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});
