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
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError("Validation failed", result.error.flatten()));
    }
    req.validated = result.data;
    next();
  };
}
