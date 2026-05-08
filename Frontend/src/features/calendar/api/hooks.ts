import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

const api = () => getApi();

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export const CALENDAR_EVENT_KINDS = ["EVENT", "REMINDER"] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export const CALENDAR_VISIBILITIES = ["private", "team", "company"] as const;
export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];

export interface CalendarAttendee {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CalendarEntry {
  id: string;
  ownerId: string;
  ownerName: string | null;
  kind: CalendarEventKind;
  visibility: CalendarVisibility;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
  reminderMinutesBefore: number | null;
  attendees: CalendarAttendee[];
  createdAt: string;
  updatedAt: string;
}

export const calendarKeys = {
  all: ["calendar"] as const,
  range: (params: Record<string, unknown>) =>
    ["calendar", "range", params] as const,
  detail: (id: string) => ["calendar", "detail", id] as const,
};

interface ListParams {
  /** ISO start of the visible window (inclusive). */
  from?: string;
  /** ISO end of the visible window (exclusive). */
  to?: string;
}

export function useCalendarEvents(params: ListParams = {}) {
  return useQuery({
    queryKey: calendarKeys.range(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/calendar", { params });
      return res.data as CalendarEntry[];
    },
  });
}

export interface CreateCalendarEventInput {
  kind: CalendarEventKind;
  visibility: CalendarVisibility;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end?: string;
  allDay?: boolean;
  reminderMinutesBefore?: number | null;
  attendees?: string[];
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCalendarEventInput) => {
      const res = await api().post("/calendar", input);
      return res.data as CalendarEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("Saved to your calendar");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save")),
  });
}

export interface UpdateCalendarEventInput {
  visibility?: CalendarVisibility;
  title?: string;
  description?: string | null;
  location?: string | null;
  start?: string;
  end?: string;
  allDay?: boolean;
  reminderMinutesBefore?: number | null;
  attendees?: string[];
}

export function useUpdateCalendarEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCalendarEventInput) => {
      const res = await api().patch(`/calendar/${id}`, input);
      return res.data as CalendarEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("Updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update")),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api().delete(`/calendar/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("Deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not delete")),
  });
}

// ─── Meeting notes ──────────────────────────────────────────────────────────

export interface MeetingNote {
  id: string;
  eventId: string;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** True when the viewer can edit / delete this note (own note or admin). */
  canManage: boolean;
}

export const meetingNoteKeys = {
  all: ["calendar", "notes"] as const,
  forEvent: (eventId: string) =>
    ["calendar", "notes", "event", eventId] as const,
};

/**
 * Notes attached to a single calendar event. Anyone with read-access to the
 * event sees the notes; owner + named attendees + admin can post. Notes
 * persist as long as the event does — useful to revisit decisions days
 * after the meeting wrapped.
 */
export function useMeetingNotes(eventId: string | null | undefined) {
  return useQuery({
    queryKey: meetingNoteKeys.forEvent(eventId ?? ""),
    enabled: !!eventId,
    queryFn: async () => {
      const res = await api().get(`/calendar/${eventId}/notes`);
      return res.data as MeetingNote[];
    },
  });
}

export function useAddMeetingNote(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await api().post(`/calendar/${eventId}/notes`, { body });
      return res.data as MeetingNote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingNoteKeys.forEvent(eventId) });
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save note")),
  });
}

export function useUpdateMeetingNote(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await api().patch(`/calendar/notes/${id}`, { body });
      return res.data as MeetingNote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingNoteKeys.forEvent(eventId) });
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update note")),
  });
}

export function useDeleteMeetingNote(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api().delete(`/calendar/notes/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingNoteKeys.forEvent(eventId) });
    },
    onError: (err) => toast.error(errorMessage(err, "Could not delete note")),
  });
}
