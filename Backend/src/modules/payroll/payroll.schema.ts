import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { BREAKDOWN_KINDS } from "../../models/payslip.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

const monthString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be YYYY-MM");

export const BreakdownItemBody = z
  .object({
    label: z.string().min(1).max(100),
    amount: z.number().nonnegative(),
    kind: z.enum(BREAKDOWN_KINDS),
  })
  .openapi("BreakdownItemBody");

export const BreakdownItemResponse = z
  .object({
    label: z.string(),
    amount: z.number().nonnegative(),
    kind: z.enum(BREAKDOWN_KINDS),
  })
  .openapi("BreakdownItem");

export const PayslipResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string().nullable(),
    month: z.string(),
    currency: z.string().length(3),
    gross: z.number().nonnegative(),
    breakdown: z.array(BreakdownItemResponse),
    netAmount: z.number().nonnegative(),
    notes: z.string().nullable(),
    generatedById: z.string(),
    generatedByName: z.string().nullable(),
    pdfUrl: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Payslip");

export const ListPayslipsResponse = z
  .object({
    items: z.array(PayslipResponse),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListPayslipsResponse");

export const CreatePayslipBody = z
  .object({
    userId: objectIdString,
    month: monthString,
    currency: z
      .string()
      .length(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    gross: z.number().nonnegative(),
    breakdown: z.array(BreakdownItemBody).optional(),
    notes: z.string().max(1000).optional(),
  })
  .openapi("CreatePayslipBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("PayrollErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/payroll/me",
  tags: ["payroll"],
  security: sec,
  request: {
    query: z.object({
      month: monthString.optional(),
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(ListPayslipsResponse) } },
});

registry.registerPath({
  method: "get",
  path: "/payroll",
  tags: ["payroll"],
  security: sec,
  request: {
    query: z.object({
      userId: objectIdString.optional(),
      month: monthString.optional(),
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListPayslipsResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/payroll",
  tags: ["payroll"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreatePayslipBody } } } },
  responses: {
    201: { description: "Created", ...json(PayslipResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    409: { description: "Already exists", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/payroll/{id}",
  tags: ["payroll"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(PayslipResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/payroll/{id}/pdf",
  tags: ["payroll"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: {
      description: "PDF stream",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});
