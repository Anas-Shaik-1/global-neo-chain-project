import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ code: err.code, message: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ code: "VALIDATION", message: "Validation failed", details: err.flatten() });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res
      .status(400)
      .json({ code: "VALIDATION", message: err.message, details: err.errors });
  }

  if ((err as { code?: number })?.code === 11000) {
    const field = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0];
    return res
      .status(409)
      .json({ code: "CONFLICT", message: `Duplicate value for ${field ?? "field"}` });
  }

  logger.error({ err }, "unhandled error");
  return res.status(500).json({ code: "INTERNAL", message: "Internal server error" });
};
