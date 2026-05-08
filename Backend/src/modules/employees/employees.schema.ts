import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { ROLES, EMPLOYMENT_TYPES, APPROVAL_STATUSES } from "../../models/user.model.js";

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
    employeeId: z.string().nullable().optional(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(ROLES),
    isProjectManager: z.boolean(),
    isActive: z.boolean(),
    approvalStatus: z.enum(APPROVAL_STATUSES),
    jobTitle: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    avatarVariants: z
      .object({
        small: z.string().nullable(),
        medium: z.string().nullable(),
        large: z.string().nullable(),
      })
      .nullable()
      .optional(),
    bio: z.string().nullable().optional(),
    createdAt: z.string().datetime().optional(),
  })
  .openapi("PublicProfile");

export const FullProfile = PublicProfile.extend({
  hireDate: z.string().datetime().nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  address: z.string().nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
  emergencyContact: EmergencyContact.nullable().optional(),
  resumeUrl: z.string().nullable().optional(),
  // Surfaced on FullProfile only — colleagues viewing PublicProfile don't
  // need to see whether someone has verified their personal phone.
  isPhoneVerified: z.boolean(),
  approvalNotes: z.string().nullable().optional(),
  hrApprovedAt: z.string().datetime().nullable().optional(),
  adminApprovedAt: z.string().datetime().nullable().optional(),
  rejectedAt: z.string().datetime().nullable().optional(),
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

// CreateEmployeeBody intentionally removed: HR no longer creates users
// directly. New users self-register via POST /auth/register and flow through
// the 2-stage HR/Admin approval pipeline (see /employees/candidates routes).

export const RejectCandidateBody = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .openapi("RejectCandidateBody");

export const ApproveHrBody = z
  .object({
    /**
     * Optional department to assign the candidate to as part of HR approval.
     * `null` clears any previously-set department; omitting the field leaves
     * the existing departmentId untouched.
     */
    departmentId: objectIdString.nullable().optional(),
  })
  .openapi("ApproveHrBody");

// NOTE: `role` and `isActive` are accepted in the schema only so the service
// can explicitly reject them with a 403 (defense in depth). Role changes go
// through a separate admin-only endpoint, and deactivation runs through
// POST /employees/:id/deactivate.
export const UpdateEmployeeBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    // Indian mobile — 10 digits, leading 6/7/8/9. The service prepends `+91`
    // before persisting. Empty string is allowed so the user can clear it.
    phone: z
      .string()
      .regex(/^([6-9]\d{9})?$/, "Phone must be a 10-digit Indian mobile number")
      .optional(),
    bio: z.string().max(500).optional(),
    dateOfBirth: z.coerce.date().optional(),
    address: z.string().max(200).optional(),
    emergencyContact: EmergencyContact.optional(),
    departmentId: objectIdString.nullable().optional(),
    jobTitle: z.string().max(100).optional(),
    hireDate: z.coerce.date().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    // Accepted only so the service rejects with 403; never persisted via PATCH.
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
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

// Approval workflow OpenAPI ----------------------------------------------

registry.registerPath({
  method: "get",
  path: "/employees/candidates",
  tags: ["employees"],
  security: sec,
  request: {
    query: z.object({
      stage: z.enum(["hr", "admin"]),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListEmployeesResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/approve-hr",
  tags: ["employees"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: ApproveHrBody } } },
  },
  responses: {
    200: { description: "Approved at HR stage", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
    409: { description: "Wrong stage", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/approve-admin",
  tags: ["employees"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "Approved at Admin stage", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
    409: { description: "Wrong stage", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/employees/{id}/reject",
  tags: ["employees"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: RejectCandidateBody } } },
  },
  responses: {
    200: { description: "Rejected", ...json(FullProfile) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
    409: { description: "Wrong stage", ...json(ErrorRef) },
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
