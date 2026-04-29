import { z } from "zod";

// Re-usable building blocks ------------------------------------------------

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(120);

/**
 * Password used at login: server enforces complexity, here we only require
 * that the user typed something. Empty-string short-circuits other rules.
 */
export const loginPasswordSchema = z.string().min(1, "Password is required");

/**
 * Strong password used when setting a new password (signup, password reset,
 * change password, etc.). Mirrors the rules listed in the conversion brief.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[0-9]/, "Must include a number");

/** TOTP / 2FA / authenticator one-time codes. */
export const totpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app");

// Concrete form schemas ----------------------------------------------------

export const LoginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type LoginValues = z.infer<typeof LoginSchema>;

export const Login2FASchema = z.object({
  token: totpCodeSchema,
});
export type Login2FAValues = z.infer<typeof Login2FASchema>;

export const RequestResetSchema = z.object({
  email: emailSchema,
});
export type RequestResetValues = z.infer<typeof RequestResetSchema>;

export const ResetPasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
export type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPasswordSchema,
    confirm: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
export type ChangePasswordValues = z.infer<typeof ChangePasswordSchema>;

export const TwoFactorVerifySchema = z.object({
  token: totpCodeSchema,
});
export type TwoFactorVerifyValues = z.infer<typeof TwoFactorVerifySchema>;

export const TwoFactorDisableSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
export type TwoFactorDisableValues = z.infer<typeof TwoFactorDisableSchema>;
