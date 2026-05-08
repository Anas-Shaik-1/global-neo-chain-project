import { z } from "zod";
import { registry } from "../../openapi/registry.js";
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_VISIBILITIES,
} from "../../models/calendarEvent.model.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

const Attendee = z
  .object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .openapi("CalendarAttendee");

export const CalendarEventResponse = z
  .object({
    id: z.string(),
    ownerId: z.string(),
    ownerName: z.string().nullable(),
    kind: z.enum(CALENDAR_EVENT_KINDS),
    visibility: z.enum(CALENDAR_VISIBILITIES),
    title: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    start: z.string().datetime(),
    end: z.string().datetime(),
    allDay: z.boolean(),
    reminderMinutesBefore: z.number().int().nonnegative().nullable(),
    attendees: z.array(Attendee),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CalendarEvent");

export const CreateCalendarEventBody = z
  .object({
    kind: z.enum(CALENDAR_EVENT_KINDS).default("EVENT"),
    visibility: z.enum(CALENDAR_VISIBILITIES).default("team"),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(300).nullable().optional(),
    start: z.string().datetime(),
    end: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    reminderMinutesBefore: z.number().int().nonnegative().max(60 * 24 * 7).nullable().optional(),
    attendees: z.array(objectIdString).max(50).optional(),
  })
  .openapi("CreateCalendarEventBody");

export const UpdateCalendarEventBody = z
  .object({
    visibility: z.enum(CALENDAR_VISIBILITIES).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(300).nullable().optional(),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    reminderMinutesBefore: z.number().int().nonnegative().max(60 * 24 * 7).nullable().optional(),
    attendees: z.array(objectIdString).max(50).optional(),
  })
  .openapi("UpdateCalendarEventBody");

export const MeetingNoteResponse = z
  .object({
    id: z.string(),
    eventId: z.string(),
    authorId: z.string(),
    authorName: z.string().nullable(),
    authorAvatarUrl: z.string().nullable(),
    body: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    canManage: z.boolean(),
  })
  .openapi("MeetingNote");

export const MeetingNoteBody = z
  .object({
    body: z.string().trim().min(1).max(5000),
  })
  .openapi("MeetingNoteBody");

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});
const ErrorRef = z
  .object({ code: z.string(), message: z.string() })
  .openapi("CalendarErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/calendar",
  tags: ["calendar"],
  security: sec,
  request: {
    query: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(z.array(CalendarEventResponse)) },
  },
});

registry.registerPath({
  method: "post",
  path: "/calendar",
  tags: ["calendar"],
  security: sec,
  request: {
    body: { content: { "application/json": { schema: CreateCalendarEventBody } } },
  },
  responses: {
    201: { description: "Created", ...json(CalendarEventResponse) },
    400: { description: "Validation failed", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/calendar/{id}",
  tags: ["calendar"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(CalendarEventResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/calendar/{id}",
  tags: ["calendar"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: {
      content: { "application/json": { schema: UpdateCalendarEventBody } },
    },
  },
  responses: {
    200: { description: "Updated", ...json(CalendarEventResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/calendar/{id}",
  tags: ["calendar"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    204: { description: "Deleted" },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/calendar/{id}/notes",
  tags: ["calendar"],
  security: sec,
  request: { params: z.object({ id: objectIdString }) },
  responses: {
    200: { description: "OK", ...json(z.array(MeetingNoteResponse)) },
    403: { description: "Forbidden", ...json(ErrorRef) },
    404: { description: "Event not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/calendar/{id}/notes",
  tags: ["calendar"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: MeetingNoteBody } } },
  },
  responses: {
    201: { description: "Created", ...json(MeetingNoteResponse) },
    403: { description: "Owner / attendees / admin only", ...json(ErrorRef) },
    404: { description: "Event not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/calendar/notes/{noteId}",
  tags: ["calendar"],
  security: sec,
  request: {
    params: z.object({ noteId: objectIdString }),
    body: { content: { "application/json": { schema: MeetingNoteBody } } },
  },
  responses: {
    200: { description: "Updated", ...json(MeetingNoteResponse) },
    403: { description: "Author / admin only", ...json(ErrorRef) },
    404: { description: "Note not found", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/calendar/notes/{noteId}",
  tags: ["calendar"],
  security: sec,
  request: { params: z.object({ noteId: objectIdString }) },
  responses: {
    204: { description: "Deleted" },
    403: { description: "Author / admin only", ...json(ErrorRef) },
    404: { description: "Note not found", ...json(ErrorRef) },
  },
});
