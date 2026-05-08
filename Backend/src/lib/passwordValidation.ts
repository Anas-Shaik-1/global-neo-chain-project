import { z } from "zod";

/**
 * Strong password rules — shared by registration, password reset, and password
 * change so all paths into the User.passwordHash column enforce the same
 * minimum strength. Mirrors the FE strongPasswordSchema.
 */
export const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");
