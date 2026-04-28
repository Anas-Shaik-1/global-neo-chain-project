import { z } from "zod";
import { registry } from "../../openapi/registry.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const ParticipantSummary = z
  .object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .openapi("ChatParticipantSummary");

export const ConversationResponse = z
  .object({
    id: z.string(),
    participants: z.array(ParticipantSummary),
    lastMessageAt: z.string().datetime().nullable(),
    lastMessagePreview: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(),
  })
  .openapi("Conversation");

export const ListConversationsResponse = z
  .array(ConversationResponse)
  .openapi("ListConversationsResponse");

export const MessageResponse = z
  .object({
    id: z.string(),
    conversationId: z.string(),
    authorId: z.string(),
    authorName: z.string().nullable(),
    body: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("ChatMessage");

export const ListMessagesResponse = z
  .array(MessageResponse)
  .openapi("ListChatMessagesResponse");

export const OpenConversationBody = z
  .object({
    otherUserId: objectIdString,
  })
  .openapi("OpenConversationBody");

export const SendMessageBody = z
  .object({
    body: z.string().min(1).max(4000),
  })
  .openapi("SendMessageBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("ChatErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/chat/conversations",
  tags: ["chat"],
  security: sec,
  responses: {
    200: { description: "OK", ...json(ListConversationsResponse) },
  },
});

registry.registerPath({
  method: "post",
  path: "/chat/conversations",
  tags: ["chat"],
  security: sec,
  request: { body: { content: { "application/json": { schema: OpenConversationBody } } } },
  responses: {
    200: { description: "OK", ...json(ConversationResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
    404: { description: "Other user not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/chat/conversations/{id}/messages",
  tags: ["chat"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    query: z.object({
      before: z.string().datetime().optional(),
      limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ListMessagesResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/chat/conversations/{id}/messages",
  tags: ["chat"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: SendMessageBody } } },
  },
  responses: {
    201: { description: "Created", ...json(MessageResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});
