import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { LoginResponse, ErrorResponse } from "../auth/auth.schema.js";
import { strongPassword } from "../../lib/passwordValidation.js";

export const RequestPasswordResetBody = z
  .object({
    email: z.string().email(),
  })
  .openapi("RequestPasswordResetBody");

export const ConfirmPasswordResetBody = z
  .object({
    token: z.string().min(1),
    newPassword: strongPassword,
  })
  .openapi("ConfirmPasswordResetBody");

export const ChangePasswordBody = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: strongPassword,
  })
  .openapi("ChangePasswordBody");

export const TotpVerifyBody = z
  .object({
    token: z
      .string()
      .regex(/^[0-9]{6}$/, "TOTP token must be 6 digits"),
  })
  .openapi("TotpVerifyBody");

export const TotpDisableBody = z
  .object({
    password: z.string().min(1),
  })
  .openapi("TotpDisableBody");

export const Login2FABody = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    token: z
      .string()
      .regex(/^[0-9]{6}$/, "TOTP token must be 6 digits"),
  })
  .openapi("Login2FABody");

export const TotpSetupResponse = z
  .object({
    secret: z.string(),
    otpauthUrl: z.string(),
    qrCodeDataUrl: z.string(),
  })
  .openapi("TotpSetupResponse");

export const VerifyEmailBody = z
  .object({
    token: z.string().min(1),
  })
  .openapi("VerifyEmailBody");

export const VerifyEmailResponse = z
  .object({
    email: z.string(),
  })
  .openapi("VerifyEmailResponse");

export const VerifyPhoneBody = z
  .object({
    code: z.string().regex(/^\d{6}$/, "6-digit code"),
  })
  .openapi("VerifyPhoneBody");

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

const sec = [{ bearerAuth: [] as string[] }];
const tag = "authExtensions";

registry.registerPath({
  method: "post",
  path: "/auth/password-reset/request",
  tags: [tag],
  request: { body: { content: { "application/json": { schema: RequestPasswordResetBody } } } },
  responses: {
    204: { description: "Always 204 — does not leak whether the email exists." },
    400: { description: "Validation error", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password-reset/confirm",
  tags: [tag],
  request: { body: { content: { "application/json": { schema: ConfirmPasswordResetBody } } } },
  responses: {
    204: { description: "Password updated" },
    400: { description: "Validation error", ...json(ErrorResponse) },
    401: { description: "Invalid or expired token", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password/change",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: ChangePasswordBody } } } },
  responses: {
    204: { description: "Password updated" },
    400: { description: "Validation error", ...json(ErrorResponse) },
    401: { description: "Wrong current password", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/2fa/setup",
  tags: [tag],
  security: sec,
  responses: {
    200: { description: "Secret + QR generated; not yet enabled.", ...json(TotpSetupResponse) },
    401: { description: "Unauthorized", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/2fa/verify",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: TotpVerifyBody } } } },
  responses: {
    204: { description: "TOTP verified — 2FA enabled." },
    400: { description: "Invalid TOTP code", ...json(ErrorResponse) },
    401: { description: "Unauthorized", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/2fa/disable",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: TotpDisableBody } } } },
  responses: {
    204: { description: "TOTP disabled." },
    401: { description: "Wrong password", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login-2fa",
  tags: [tag],
  request: { body: { content: { "application/json": { schema: Login2FABody } } } },
  responses: {
    200: { description: "Logged in", ...json(LoginResponse) },
    401: { description: "Invalid credentials or TOTP", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify-email/request",
  tags: [tag],
  security: sec,
  responses: {
    204: { description: "Verification email dispatched." },
    401: { description: "Unauthorized", ...json(ErrorResponse) },
    409: { description: "Email already verified", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify-email/confirm",
  tags: [tag],
  request: { body: { content: { "application/json": { schema: VerifyEmailBody } } } },
  responses: {
    200: { description: "Email verified", ...json(VerifyEmailResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
    401: { description: "Invalid or expired token", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/phone/request-verify",
  tags: [tag],
  security: sec,
  responses: {
    204: { description: "OTP sent via SMS" },
    400: { description: "No phone number set", ...json(ErrorResponse) },
    409: { description: "Already verified", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/phone/verify",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: VerifyPhoneBody } } } },
  responses: {
    204: { description: "Verified" },
    401: { description: "Wrong/expired code", ...json(ErrorResponse) },
  },
});
