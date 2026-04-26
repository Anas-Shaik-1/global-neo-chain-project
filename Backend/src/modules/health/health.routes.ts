import { Router } from "express";
import { z } from "zod";
import { registry } from "../../openapi/registry.js";

export const healthRouter = Router();

const HealthResponse = z.object({ status: z.literal("ok") }).openapi("HealthResponse");

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["health"],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: HealthResponse } } },
  },
});

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});
