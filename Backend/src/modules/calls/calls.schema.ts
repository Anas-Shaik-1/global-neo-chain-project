import { z } from "zod";
import { registry } from "../../openapi/registry.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const CallParticipantSummary = z
  .object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .openapi("CallParticipantSummary");

export const CallSessionResponse = z
  .object({
    id: z.string(),
    caller: CallParticipantSummary,
    callee: CallParticipantSummary,
    status: z.enum(["INVITED", "ACTIVE", "ENDED", "REJECTED", "MISSED"]),
    startedAt: z.string().datetime(),
    acceptedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    endReason: z.enum(["HANGUP", "REJECT", "TIMEOUT", "ERROR"]).nullable(),
  })
  .openapi("CallSession");

export const ListCallsResponse = z
  .array(CallSessionResponse)
  .openapi("ListCallsResponse");

export const CreateCallBody = z
  .object({
    calleeId: objectIdString,
  })
  .openapi("CreateCallBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z
  .object({ code: z.string(), message: z.string() })
  .openapi("CallsErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "post",
  path: "/calls",
  tags: ["calls"],
  security: sec,
  request: { body: { content: { "application/json": { schema: CreateCallBody } } } },
  responses: {
    201: { description: "Created", ...json(CallSessionResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
    404: { description: "Callee not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/calls/me",
  tags: ["calls"],
  security: sec,
  request: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListCallsResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/calls/{id}/end",
  tags: ["calls"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(CallSessionResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});
