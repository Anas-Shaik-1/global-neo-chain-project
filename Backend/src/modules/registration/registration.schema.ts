import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { APPROVAL_STATUSES } from "../../models/user.model.js";
import { strongPassword } from "../../lib/passwordValidation.js";

export const RegisterBody = z
  .object({
    email: z.string().email().max(120),
    name: z.string().trim().min(1).max(100),
    password: strongPassword,
    // Indian mobile — 10 digits, leading 6/7/8/9. The service layer prepends
    // `+91` before persisting; the wire format is the bare subscriber number.
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Phone must be a 10-digit Indian mobile number")
      .optional(),
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

// Multipart form contract. The text fields mirror RegisterBody; `file` is
// the (mandatory) profile picture. We document the shape with z.any() for
// the binary so the OpenAPI generator emits a `format: binary` field.
const RegisterMultipart = z
  .object({
    email: z.string().email().max(120),
    name: z.string().trim().min(1).max(100),
    password: strongPassword,
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Phone must be a 10-digit Indian mobile number")
      .optional(),
    file: z
      .any()
      .openapi({
        type: "string",
        format: "binary",
        description: "Profile picture (PNG/JPEG/WebP/GIF, ≤ 2 MB). Required.",
      }),
  })
  .openapi("RegisterMultipart");

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["auth"],
  request: {
    body: {
      content: { "multipart/form-data": { schema: RegisterMultipart } },
    },
  },
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
