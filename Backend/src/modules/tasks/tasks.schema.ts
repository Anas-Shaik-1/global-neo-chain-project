import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { TASK_STATUSES, TASK_PRIORITIES } from "../../models/task.model.js";
import { TASK_ACTIVITY_KINDS } from "../../models/taskActivity.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const ProjectResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    key: z.string(),
    description: z.string().nullable().optional(),
    taskCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Project");

export const ListProjectsResponse = z
  .object({
    items: z.array(ProjectResponse),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListProjectsResponse");

export const TaskResponse = z
  .object({
    id: z.string(),
    projectId: z.string(),
    projectKey: z.string(),
    projectName: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    assigneeId: z.string().nullable().optional(),
    assigneeName: z.string().nullable().optional(),
    createdById: z.string(),
    createdByName: z.string().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    parentTaskId: z.string().nullable().optional(),
    subtaskCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Task");

export const ActivityKindEnum = z.enum(TASK_ACTIVITY_KINDS).openapi("TaskActivityKind");

export const TaskActivityResponse = z
  .object({
    id: z.string(),
    taskId: z.string(),
    actorId: z.string(),
    actorName: z.string().nullable().optional(),
    kind: ActivityKindEnum,
    fromValue: z.string().nullable().optional(),
    toValue: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
  })
  .openapi("TaskActivity");

export const CommentResponse = z
  .object({
    id: z.string(),
    taskId: z.string(),
    authorId: z.string(),
    authorName: z.string().nullable().optional(),
    body: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("TaskComment");

export const CreateProjectBody = z
  .object({
    name: z.string().min(1).max(100),
    key: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/, "key must be lowercase alphanumeric or hyphens"),
    description: z.string().max(500).optional(),
  })
  .openapi("CreateProjectBody");

export const CreateTaskBody = z
  .object({
    projectId: objectIdString,
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: objectIdString.nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    parentTaskId: objectIdString.nullable().optional(),
  })
  .openapi("CreateTaskBody");

export const UpdateTaskBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: objectIdString.nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .openapi("UpdateTaskBody");

export const CreateCommentBody = z
  .object({
    body: z.string().min(1).max(2000),
  })
  .openapi("CreateCommentBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("TaskErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/projects",
  tags: ["tasks"],
  security: sec,
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(ListProjectsResponse) } },
});

registry.registerPath({
  method: "post",
  path: "/projects",
  tags: ["tasks"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateProjectBody } } } },
  responses: {
    201: { description: "Created", ...json(ProjectResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    409: { description: "Conflict", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/projects/{id}",
  tags: ["tasks"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(ProjectResponse) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/projects/{id}/tasks",
  tags: ["tasks"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    query: z.object({
      status: z.enum(TASK_STATUSES).optional(),
      assignee: objectIdString.optional(),
      priority: z.enum(TASK_PRIORITIES).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(z.array(TaskResponse)) } },
});

registry.registerPath({
  method: "post",
  path: "/tasks",
  tags: ["tasks"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateTaskBody } } } },
  responses: {
    201: { description: "Created", ...json(TaskResponse) },
    404: { description: "Project not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/tasks/{id}",
  tags: ["tasks"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(TaskResponse) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/tasks/{id}",
  tags: ["tasks"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdateTaskBody } } },
  },
  responses: {
    200: { description: "Updated", ...json(TaskResponse) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/tasks/{id}/comments",
  tags: ["tasks"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 200: { description: "OK", ...json(z.array(CommentResponse)) } },
});

registry.registerPath({
  method: "post",
  path: "/tasks/{id}/comments",
  tags: ["tasks"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: CreateCommentBody } } },
  },
  responses: {
    201: { description: "Created", ...json(CommentResponse) },
    404: { description: "Task not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/tasks/{id}/activity",
  tags: ["tasks"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(z.array(TaskActivityResponse)) },
    404: { description: "Task not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/tasks/{id}/subtasks",
  tags: ["tasks"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(z.array(TaskResponse)) },
    404: { description: "Task not found", ...json(ErrorRef) },
  },
});
