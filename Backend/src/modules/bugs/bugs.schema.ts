import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { BUG_STATUSES } from "../../models/bug.model.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../models/task.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const BugResponse = z
  .object({
    id: z.string(),
    title: z.string(),
    code: z.string(),
    description: z.string(),
    imageUrl: z.string().nullable(),
    status: z.enum(BUG_STATUSES),
    createdById: z.string(),
    createdByName: z.string().nullable(),
    /** Optional — bugs not tied to a project leave both fields null. */
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    projectKey: z.string().nullable(),
    /** Linked Task created via "Create task" — null until the bug is
     *  promoted. Title + status mirrored so the FE can render a chip
     *  without a second API call. */
    linkedTaskId: z.string().nullable(),
    linkedTaskTitle: z.string().nullable(),
    linkedTaskStatus: z.enum(TASK_STATUSES).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Bug");

export const PagedBugsResponse = z
  .object({
    items: z.array(BugResponse),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  })
  .openapi("PagedBugsResponse");

export const CreateBugBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(1).max(5000),
    /** Optional project this bug belongs to. */
    projectId: objectIdString.optional(),
  })
  .openapi("CreateBugBody");

export const UpdateBugBody = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    status: z.enum(BUG_STATUSES).optional(),
    /** Pass `null` to clear; an id to (re-)assign. */
    projectId: objectIdString.nullable().optional(),
  })
  .openapi("UpdateBugBody");

export const CreateTaskFromBugBody = z
  .object({
    /** Optional override; defaults to the bug's projectId if it has one. */
    projectId: objectIdString.optional(),
    assigneeId: objectIdString.nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
  })
  .openapi("CreateTaskFromBugBody");

export const ListBugsQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(BUG_STATUSES).optional(),
  projectId: objectIdString.optional(),
});

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorResponse = z.object({ code: z.string(), message: z.string() }).openapi("BugErrorResponse");

const tag = "bugs";
const sec = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/bugs",
  tags: [tag],
  security: sec,
  request: { query: ListBugsQuery },
  responses: {
    200: { description: "Paged list of bugs", ...json(PagedBugsResponse) },
  },
});

registry.registerPath({
  method: "get",
  path: "/bugs/{id}",
  tags: [tag],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Bug detail", ...json(BugResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/bugs",
  tags: [tag],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateBugBody } } } },
  responses: {
    201: { description: "Bug created", ...json(BugResponse) },
    400: { description: "Validation error", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/bugs/{id}",
  tags: [tag],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdateBugBody } } },
  },
  responses: {
    200: { description: "Updated bug", ...json(BugResponse) },
    403: { description: "Only the bug's reporter or an ADMIN can edit", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/bugs/{id}/create-task",
  tags: [tag],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: CreateTaskFromBugBody } } },
  },
  responses: {
    201: { description: "Bug now linked to a new Task", ...json(BugResponse) },
    400: { description: "Already linked / no project to file into", ...json(ErrorResponse) },
    403: { description: "Only the bug's reporter or an Admin", ...json(ErrorResponse) },
    404: { description: "Not found", ...json(ErrorResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/bugs/{id}/image",
  tags: [tag],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ image: z.string().describe("binary image, ≤5MB") }),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated bug with new imageUrl", ...json(BugResponse) },
    403: { description: "Only the bug's reporter or an ADMIN can edit", ...json(ErrorResponse) },
  },
});
