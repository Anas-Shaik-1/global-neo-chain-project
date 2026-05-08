import { z } from "zod";
import { registry } from "../../openapi/registry.js";

/**
 * Public contact-form payload from the marketing landing page. Sent over
 * an unauthenticated POST /contact, so the validation has to do double
 * duty (size limits + a honeypot for bot mitigation). The honeypot field
 * is invisible in the rendered form; bots fill it; we drop the request.
 */
export const ContactSubmissionBody = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    company: z.string().trim().max(100).optional().or(z.literal("")),
    message: z
      .string()
      .trim()
      .min(10, "Message must be at least 10 characters")
      .max(4000, "Message must be 4000 characters or fewer"),
    /**
     * Honeypot: legit users leave this blank because the field is hidden;
     * any non-empty value means a bot filled the form. Server returns 204
     * but doesn't actually do anything with the submission, so attackers
     * don't learn whether their bot was caught.
     */
    website: z.string().max(200).optional(),
  })
  .openapi("ContactSubmissionBody");

export const ContactSubmissionResponse = z
  .object({
    id: z.string(),
    receivedAt: z.string().datetime(),
  })
  .openapi("ContactSubmissionResponse");

const ErrorResponse = z
  .object({ code: z.string(), message: z.string() })
  .openapi("ContactErrorResponse");

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

registry.registerPath({
  method: "post",
  path: "/contact",
  tags: ["contact"],
  summary: "Submit a contact-form enquiry from the public landing page.",
  request: { body: { content: { "application/json": { schema: ContactSubmissionBody } } } },
  responses: {
    201: { description: "Submission saved + notification email queued", ...json(ContactSubmissionResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
    429: { description: "Rate limited", ...json(ErrorResponse) },
  },
});
