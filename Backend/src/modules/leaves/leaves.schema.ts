import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import {
  LEAVE_STATUSES,
  LEAVE_TYPES,
} from "../../models/leaveRequest.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const LeaveResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    type: z.enum(LEAVE_TYPES),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string(),
    status: z.enum(LEAVE_STATUSES),
    decisionById: z.string().nullable(),
    decisionByName: z.string().nullable(),
    decisionAt: z.string().nullable(),
    decisionNotes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("LeaveRequest");

export const PagedLeavesResponse = z
  .object({
    items: z.array(LeaveResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  })
  .openapi("PagedLeavesResponse");

export const CreateLeaveBody = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim().min(1).max(500),
  })
  .openapi("CreateLeaveBody");

export const RejectLeaveBody = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .openapi("RejectLeaveBody");

export const ListLeavesQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(LEAVE_STATUSES).optional(),
  type: z.enum(LEAVE_TYPES).optional(),
  userId: objectIdString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});
const ErrorResponse = z
  .object({ code: z.string(), message: z.string() })
  .openapi("LeaveErrorResponse");

const tag = "leaves";
const sec = [{ bearerAuth: [] }];

registry.registerPath({
  method: "post",
  path: "/leaves",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateLeaveBody } } } },
  responses: {
    201: { description: "Leave created", ...json(LeaveResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
    409: { description: "Overlaps an existing request", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "get",
  path: "/leaves/mine",
  tags: [tag],
  security: sec,
  responses: { 200: { description: "Own leaves", ...json(PagedLeavesResponse) } },
});

registry.registerPath({
  method: "get",
  path: "/leaves",
  tags: [tag],
  security: sec,
  request: { query: ListLeavesQuery },
  responses: {
    200: { description: "All leaves (admin)", ...json(PagedLeavesResponse) },
    403: { description: "Admins only", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/leaves/{id}/cancel",
  tags: [tag],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Cancelled", ...json(LeaveResponse) },
    403: { description: "Not the owner", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
    409: { description: "Already decided/cancelled", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/leaves/{id}/approve",
  tags: [tag],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Approved", ...json(LeaveResponse) },
    403: { description: "Admins only", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
    409: { description: "Already decided/cancelled", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/leaves/{id}/reject",
  tags: [tag],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: RejectLeaveBody } } },
  },
  responses: {
    200: { description: "Rejected", ...json(LeaveResponse) },
    403: { description: "Admins only", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
    409: { description: "Already decided/cancelled", ...json(ErrorResponse) },
  },
});
