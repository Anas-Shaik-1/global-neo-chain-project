import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { APPROVAL_STATUSES } from "../../models/user.model.js";

const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

/**
 * Strong password rules — these mirror the FE strongPasswordSchema so the
 * server is the source of truth for what counts as strong.
 */
const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const RegisterBody = z
  .object({
    email: z.string().email().max(120),
    name: z.string().trim().min(1).max(100),
    password: strongPassword,
    phone: z
      .string()
      .regex(/^[+\d][\d\s\-()]{6,24}$/)
      .max(25)
      .optional(),
    departmentId: objectIdString.optional(),
  })
  .openapi("RegisterBody");

export const RegisterResponse = z
  .object({
    id: z.string(),
    email: z.string().email(),
    approvalStatus: z.enum(APPROVAL_STATUSES),
  })
  .openapi("RegisterResponse");

export const RegistrationStatusResponse = z
  .object({
    approvalStatus: z.enum(APPROVAL_STATUSES),
  })
  .openapi("RegistrationStatusResponse");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("RegErrorRef");

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["auth"],
  request: { body: { content: { "application/json": { schema: RegisterBody } } } },
  responses: {
    201: { description: "Registered (pending HR approval)", ...json(RegisterResponse) },
    400: { description: "Validation error", ...json(ErrorRef) },
    409: { description: "Email already in use", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/registration-status",
  tags: ["auth"],
  request: {
    query: z.object({ email: z.string().email() }),
  },
  responses: {
    200: { description: "Status", ...json(RegistrationStatusResponse) },
    404: { description: "No application found for this email", ...json(ErrorRef) },
  },
});
