import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      validated?: unknown;
    }
  }
}

export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    // Some routes accept all-optional bodies; clients that omit Content-Type
    // or send no body land here with `req.body` as undefined. Treat that as
    // an empty object so a fully-optional schema still parses cleanly.
    const payload = req.body ?? {};
    const result = schema.safeParse(payload);
    if (!result.success) {
      return next(new ValidationError("Validation failed", result.error.flatten()));
    }
    req.validated = result.data;
    next();
  };
}
