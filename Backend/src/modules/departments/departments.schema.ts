import { z } from "zod";
import { registry } from "../../openapi/registry.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const DepartmentResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    description: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
    managerName: z.string().nullable().optional(),
    employeeCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Department");

export const ListDepartmentsResponse = z
  .object({
    items: z.array(DepartmentResponse),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListDepartmentsResponse");

export const CreateDepartmentBody = z
  .object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(30),
    description: z.string().max(500).optional(),
    managerId: objectIdString.optional(),
  })
  .openapi("CreateDepartmentBody");

export const UpdateDepartmentBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(30).optional(),
    description: z.string().max(500).nullable().optional(),
    managerId: objectIdString.nullable().optional(),
  })
  .openapi("UpdateDepartmentBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("DeptErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/departments",
  tags: ["departments"],
  security: sec,
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(ListDepartmentsResponse) } },
});

registry.registerPath({
  method: "post",
  path: "/departments",
  tags: ["departments"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateDepartmentBody } } } },
  responses: {
    201: { description: "Created", ...json(DepartmentResponse) },
    409: { description: "Conflict", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/departments/{id}",
  tags: ["departments"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdateDepartmentBody } } },
  },
  responses: { 200: { description: "Updated", ...json(DepartmentResponse) } },
});

registry.registerPath({
  method: "delete",
  path: "/departments/{id}",
  tags: ["departments"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    204: { description: "Deleted" },
    409: { description: "Has employees", ...json(ErrorRef) },
  },
});
