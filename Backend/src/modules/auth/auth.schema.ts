import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { ROLES } from "../../models/user.model.js";

export const LoginBody = z
  .object({
    email: z.string().email().openapi({ example: "admin@global-neochain.local" }),
    password: z.string().min(1).openapi({ example: "ChangeMe-Admin-1!" }),
  })
  .openapi("LoginBody");

export const PublicUser = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(ROLES),
    isProjectManager: z.boolean(),
    isVerified: z.boolean(),
    mustChangePassword: z.boolean(),
    totpEnabled: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PublicUser");

export const AccessTokenResponse = z
  .object({
    accessToken: z.string(),
  })
  .openapi("AccessTokenResponse");

export const LoginResponse = AccessTokenResponse.extend({
  user: PublicUser,
}).openapi("LoginResponse");

// /auth/login can return this instead when the user has TOTP enabled — the FE
// should then show a 6-digit prompt and POST /auth/login-2fa with the code.
export const Requires2FAResponse = z
  .object({ requires2FA: z.literal(true) })
  .openapi("Requires2FAResponse");

export const ErrorResponse = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .openapi("ErrorResponse");

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["auth"],
  request: { body: { content: { "application/json": { schema: LoginBody } } } },
  responses: {
    200: { description: "OK", ...json(LoginResponse) },
    401: { description: "Invalid credentials", ...json(ErrorResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["auth"],
  responses: {
    200: { description: "Rotated", ...json(AccessTokenResponse) },
    401: { description: "Invalid refresh", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["auth"],
  responses: {
    204: { description: "Logged out" },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Current user", ...json(z.object({ user: PublicUser })) },
    401: { description: "Unauthorized", ...json(ErrorResponse) },
  },
});
