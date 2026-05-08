import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
} from "../../models/feedback.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const FeedbackResponse = z
  .object({
    id: z.string(),
    kind: z.enum(FEEDBACK_KINDS),
    subject: z.string(),
    body: z.string(),
    status: z.enum(FEEDBACK_STATUSES),
    isAnonymous: z.boolean(),
    submitterId: z.string().nullable(),
    submitterName: z.string().nullable(),
    reviewNote: z.string().nullable(),
    reviewedById: z.string().nullable(),
    reviewedByName: z.string().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Feedback");

export const PagedFeedback = z
  .object({
    items: z.array(FeedbackResponse),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("PagedFeedback");

export const SubmitFeedbackBody = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    isAnonymous: z.boolean().default(false),
  })
  .openapi("SubmitFeedbackBody");

export const ReviewFeedbackBody = z
  .object({
    status: z.enum(FEEDBACK_STATUSES),
    reviewNote: z.string().max(1000).optional(),
  })
  .openapi("ReviewFeedbackBody");

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});
const ErrorRef = z
  .object({ code: z.string(), message: z.string() })
  .openapi("FeedbackErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "post",
  path: "/feedback",
  tags: ["feedback"],
  security: sec,
  request: { body: { content: { "application/json": { schema: SubmitFeedbackBody } } } },
  responses: {
    201: { description: "Submitted", ...json(FeedbackResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/feedback",
  tags: ["feedback"],
  security: sec,
  request: {
    query: z.object({
      mine: z.coerce.boolean().optional(),
      status: z.enum(FEEDBACK_STATUSES).optional(),
      kind: z.enum(FEEDBACK_KINDS).optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(PagedFeedback) } },
});

registry.registerPath({
  method: "get",
  path: "/feedback/{id}",
  tags: ["feedback"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(FeedbackResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/feedback/{id}/review",
  tags: ["feedback"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: ReviewFeedbackBody } } },
  },
  responses: {
    200: { description: "Reviewed", ...json(FeedbackResponse) },
    403: { description: "Admin/HR only", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});
