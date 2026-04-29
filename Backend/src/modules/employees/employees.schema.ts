import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { ROLES, EMPLOYMENT_TYPES } from "../../models/user.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const EmergencyContact = z
  .object({
    name: z.string().min(1).max(100),
    phone: z.string().min(1).max(25),
    relationship: z.string().min(1).max(50),
  })
  .openapi("EmergencyContact");

export const PublicProfile = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(ROLES),
    isProjectManager: z.boolean(),
    isActive: z.boolean(),
    jobTitle: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
  })
  .openapi("PublicProfile");

export const FullProfile = PublicProfile.extend({
  hireDate: z.string().datetime().nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  address: z.string().nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
  emergencyContact: EmergencyContact.nullable().optional(),
  resumeUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi("FullProfile");

export const ListEmployeesResponse = z
  .object({
    items: z.array(PublicProfile),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListEmployeesResponse");

export const CreateEmployeeBody = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    role: z.enum(ROLES).default("EMPLOYEE"),
    jobTitle: z.string().max(100).optional(),
    departmentId: objectIdString.optional(),
  })
  .openapi("CreateEmployeeBody");

export const UpdateEmployeeBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().max(25).optional(),
    bio: z.string().max(500).optional(),
    dateOfBirth: z.coerce.date().optional(),
    address: z.string().max(200).optional(),
    emergencyContact: EmergencyContact.optional(),
    role: z.enum(ROLES).optional(),
    departmentId: objectIdString.nullable().optional(),
    isActive: z.boolean().optional(),
    jobTitle: z.string().max(100).optional(),
    hireDate: z.coerce.date().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  })
  .openapi("UpdateEmployeeBody");

export const PositionResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    departmentId: z.string().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable().optional(),
  })
  .openapi("Position");

export const CreatePositionBody = z
  .object({
    title: z.string().min(1).max(100),
    departmentId: objectIdString.optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date().nullable().optional(),
  })
  .openapi("CreatePositionBody");

export const UpdatePositionBody = z
  .object({
    title: z.string().min(1).max(100).optional(),
    departmentId: objectIdString.nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().nullable().optional(),
  })
  .openapi("UpdatePositionBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });

const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("EmpErrorRef");

const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/employees",
  tags: ["employees"],
  security: sec,
  request: {
    query: z.object({
      q: z.string().optional(),
      department: objectIdString.optional(),
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListEmployeesResponse) },
    401: { description: "Unauthorized", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/employees/{id}",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(FullProfile) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees",
  tags: ["employees"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateEmployeeBody } } } },
  responses: {
    201: { description: "Created", ...json(FullProfile) },
    409: { description: "Email exists", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/employees/{id}",
  tags: ["employees"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdateEmployeeBody } } },
  },
  responses: {
    200: { description: "Updated", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/deactivate",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    204: { description: "Deactivated" },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/promote-pm",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Promoted", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/demote-pm",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Demoted", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

const fileUploadBody = {
  content: {
    "multipart/form-data": {
      schema: z.object({ file: z.string() }).openapi({ type: "object" }),
    },
  },
};

registry.registerPath({
  method: "post",
  path: "/employees/{id}/avatar",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }), body: fileUploadBody },
  responses: { 200: { description: "OK", ...json(z.object({ avatarUrl: z.string() })) } },
});

registry.registerPath({
  method: "delete",
  path: "/employees/{id}/avatar",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 204: { description: "Cleared" } },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/resume",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }), body: fileUploadBody },
  responses: { 200: { description: "OK", ...json(z.object({ resumeUrl: z.string() })) } },
});

registry.registerPath({
  method: "delete",
  path: "/employees/{id}/resume",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 204: { description: "Cleared" } },
});

registry.registerPath({
  method: "get",
  path: "/employees/{id}/positions",
  tags: ["positions"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: { 200: { description: "OK", ...json(z.array(PositionResponse)) } },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/positions",
  tags: ["positions"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: CreatePositionBody } } },
  },
  responses: { 201: { description: "Created", ...json(PositionResponse) } },
});

registry.registerPath({
  method: "patch",
  path: "/positions/{id}",
  tags: ["positions"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: UpdatePositionBody } } },
  },
  responses: { 200: { description: "Updated", ...json(PositionResponse) } },
});
