import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import { NOTIFICATION_KINDS } from "../../models/notification.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

export const NotificationResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    kind: z.enum(NOTIFICATION_KINDS),
    title: z.string(),
    body: z.string().nullable(),
    link: z.string().nullable(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("Notification");

export const ListNotificationsResponse = z
  .object({ items: z.array(NotificationResponse) })
  .openapi("ListNotificationsResponse");

export const UnreadCountResponse = z
  .object({ count: z.number().int().nonnegative() })
  .openapi("UnreadCountResponse");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("NotificationErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/notifications/me",
  tags: ["notifications"],
  security: sec,
  request: {
    query: z.object({
      unread: z.enum(["true", "false"]).optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  },
  responses: { 200: { description: "OK", ...json(ListNotificationsResponse) } },
});

registry.registerPath({
  method: "get",
  path: "/notifications/me/unread-count",
  tags: ["notifications"],
  security: sec,
  responses: { 200: { description: "OK", ...json(UnreadCountResponse) } },
});

registry.registerPath({
  method: "post",
  path: "/notifications/me/{id}/read",
  tags: ["notifications"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    204: { description: "Marked read" },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/notifications/me/read-all",
  tags: ["notifications"],
  security: sec,
  responses: { 204: { description: "All marked read" } },
});
