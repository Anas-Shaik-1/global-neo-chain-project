import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./errors.js";

describe("AppError", () => {
  it("captures statusCode, code, message, details", () => {
    const err = new AppError(418, "TEAPOT", "I'm a teapot", { hot: true });
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("TEAPOT");
    expect(err.message).toBe("I'm a teapot");
    expect(err.details).toEqual({ hot: true });
    expect(err).toBeInstanceOf(Error);
  });

  it("ValidationError defaults to 400 + VALIDATION", () => {
    const err = new ValidationError("bad", { field: "email" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION");
    expect(err.details).toEqual({ field: "email" });
  });

  it("UnauthorizedError defaults to 401 + UNAUTHORIZED", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("ForbiddenError defaults to 403 + FORBIDDEN", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("NotFoundError defaults to 404 + NOT_FOUND", () => {
    const err = new NotFoundError("user");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("user not found");
  });

  it("ConflictError defaults to 409 + CONFLICT", () => {
    const err = new ConflictError("email already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
