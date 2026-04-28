import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from "../../models/expense.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const ExpenseResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string().nullable(),
    amount: z.number().nonnegative(),
    currency: z.string().length(3),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string(),
    incurredOn: z.string().datetime(),
    receiptUrl: z.string().nullable(),
    status: z.enum(EXPENSE_STATUSES),
    decisionById: z.string().nullable(),
    decisionByName: z.string().nullable(),
    decisionNote: z.string().nullable(),
    decidedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Expense");

export const ListExpensesResponse = z
  .object({
    items: z.array(ExpenseResponse),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListExpensesResponse");

export const CreateExpenseBody = z
  .object({
    amount: z.number().nonnegative(),
    currency: z
      .string()
      .length(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().min(1).max(500),
    incurredOn: z.coerce.date(),
  })
  .openapi("CreateExpenseBody");

export const DecideExpenseBody = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().max(500).optional(),
  })
  .openapi("DecideExpenseBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("ExpenseErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/expenses/me",
  tags: ["expenses"],
  security: sec,
  request: {
    query: z.object({
      status: z.enum(EXPENSE_STATUSES).optional(),
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(ListExpensesResponse) } },
});

registry.registerPath({
  method: "get",
  path: "/expenses",
  tags: ["expenses"],
  security: sec,
  request: {
    query: z.object({
      status: z.enum(EXPENSE_STATUSES).optional(),
      userId: objectIdString.optional(),
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListExpensesResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/expenses",
  tags: ["expenses"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateExpenseBody } } } },
  responses: {
    201: { description: "Created", ...json(ExpenseResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/expenses/{id}",
  tags: ["expenses"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(ExpenseResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/expenses/{id}/receipt",
  tags: ["expenses"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.string().openapi({ format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "OK", ...json(ExpenseResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/expenses/{id}/receipt",
  tags: ["expenses"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(ExpenseResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/expenses/{id}/decide",
  tags: ["expenses"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: DecideExpenseBody } } },
  },
  responses: {
    200: { description: "OK", ...json(ExpenseResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
    409: { description: "Already decided", ...json(ErrorRef) },
  },
});
