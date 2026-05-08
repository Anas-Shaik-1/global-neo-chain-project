import { Types } from "mongoose";
import {
  CalendarEvent,
  type CalendarEventDoc,
  type CalendarEventKind,
  type CalendarVisibility,
} from "../../models/calendarEvent.model.js";
import {
  MeetingNote,
  type MeetingNoteDoc,
} from "../../models/meetingNote.model.js";
import { User, type Role } from "../../models/user.model.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export interface AttendeeSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CalendarEventResponseShape {
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
  attendees: AttendeeSummary[];
  createdAt: string;
  updatedAt: string;
}

async function buildPeopleMap(
  ids: Types.ObjectId[],
): Promise<Map<string, AttendeeSummary>> {
  const unique = Array.from(new Set(ids.map((i) => i.toString())));
  const map = new Map<string, AttendeeSummary>();
  if (unique.length === 0) return map;
  const users = await User.find({
    _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
  })
    .select("name avatarUrl")
    .lean<{ _id: Types.ObjectId; name: string; avatarUrl?: string | null }[]>();
  for (const u of users) {
    map.set(u._id.toString(), {
      id: u._id.toString(),
      name: u.name,
      avatarUrl: u.avatarUrl ?? null,
    });
  }
  return map;
}

function denormalize(
  doc: CalendarEventDoc,
  people: Map<string, AttendeeSummary>,
): CalendarEventResponseShape {
  const ts = doc as unknown as { createdAt: Date; updatedAt: Date };
  const ownerKey = doc.ownerId.toString();
  return {
    id: doc._id.toString(),
    ownerId: ownerKey,
    ownerName: people.get(ownerKey)?.name ?? null,
    kind: doc.kind as CalendarEventKind,
    visibility: doc.visibility as CalendarVisibility,
    title: doc.title,
    description: doc.description ?? null,
    location: doc.location ?? null,
    start: doc.start.toISOString(),
    end: doc.end.toISOString(),
    allDay: !!doc.allDay,
    reminderMinutesBefore: doc.reminderMinutesBefore ?? null,
    attendees: (doc.attendees ?? []).map((id) => {
      const k = id.toString();
      return (
        people.get(k) ?? { id: k, name: "Unknown", avatarUrl: null }
      );
    }),
    createdAt: ts.createdAt.toISOString(),
    updatedAt: ts.updatedAt.toISOString(),
  };
}

function canManage(
  doc: CalendarEventDoc,
  viewer: { id: string; role: Role },
): boolean {
  if (doc.ownerId.toString() === viewer.id) return true;
  return viewer.role === "ADMIN";
}

function canSee(
  doc: CalendarEventDoc,
  viewer: { id: string; role: Role },
): boolean {
  if (doc.visibility === "company") return true;
  if (doc.ownerId.toString() === viewer.id) return true;
  if (
    doc.visibility === "team" &&
    doc.attendees.some((id) => id.toString() === viewer.id)
  ) {
    return true;
  }
  return viewer.role === "ADMIN";
}

export interface ListInput {
  /** ISO start of the visible window (inclusive). */
  from?: Date;
  /** ISO end of the visible window (exclusive). */
  to?: Date;
}

/**
 * Returns every entry visible to `viewer` whose window intersects
 * [from, to). Defaults to a 60-day window centred on today so the FE can
 * paint a typical month-or-two view without thinking about defaults.
 *
 * Visibility filter mirrors `canSee`: own + invited + company-wide. Admins
 * can see everything but only get it via the `?all=true` flag (see
 * controller); the default list stays scoped so admin's calendar isn't
 * an unwanted firehose of every reminder in the org.
 */
export async function listVisibleEvents(
  viewer: { id: string; role: Role },
  input: ListInput,
): Promise<CalendarEventResponseShape[]> {
  const now = new Date();
  const from =
    input.from ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30));
  const to =
    input.to ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30));

  const me = new Types.ObjectId(viewer.id);
  const docs = await CalendarEvent.find({
    // Window overlap: doc.start < to AND doc.end > from
    start: { $lt: to },
    end: { $gt: from },
    $or: [
      { visibility: "company" },
      { ownerId: me },
      { visibility: "team", attendees: me },
    ],
  })
    .sort({ start: 1 })
    .limit(500);

  const ids: Types.ObjectId[] = [];
  for (const d of docs) {
    ids.push(d.ownerId);
    for (const a of d.attendees) ids.push(a);
  }
  const people = await buildPeopleMap(ids);
  return docs.map((d) => denormalize(d, people));
}

export interface CreateEventInput {
  kind: CalendarEventKind;
  visibility: CalendarVisibility;
  title: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  end?: Date;
  allDay?: boolean;
  reminderMinutesBefore?: number | null;
  attendees?: string[];
}

/**
 * Company-wide events fan a notification out to every authenticated user
 * and clutter every employee's calendar. Restrict the ability to publish
 * to that scope to HR / ADMIN — regular employees can still create
 * private and team-visibility events freely.
 */
function ensureCanPublishCompanyWide(
  visibility: CalendarVisibility,
  viewer: { role: Role },
): void {
  if (visibility !== "company") return;
  if (viewer.role === "ADMIN" || viewer.role === "HR") return;
  throw new ForbiddenError(
    "Only HR or Admin can publish company-wide events",
  );
}

function validateAttendeesFormat(attendees: string[] | undefined): void {
  if (!attendees) return;
  for (const id of attendees) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError(`attendees: '${id}' is not a valid id`);
    }
  }
}

async function ensureAttendeesExist(attendees: string[] | undefined): Promise<Types.ObjectId[]> {
  if (!attendees || attendees.length === 0) return [];
  const unique = Array.from(new Set(attendees));
  const found = await User.find({
    _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();
  if (found.length !== unique.length) {
    throw new ValidationError("attendees: one or more ids don't exist");
  }
  return found.map((u) => u._id);
}

export async function createEvent(
  owner: { id: string; role: Role },
  input: CreateEventInput,
): Promise<CalendarEventResponseShape> {
  ensureCanPublishCompanyWide(input.visibility, owner);
  validateAttendeesFormat(input.attendees);
  const title = input.title.trim();
  if (!title) throw new ValidationError("title is required");
  const ownerId = owner.id;

  // Reminder kind has no real "end" — the start instant IS the fire time.
  // We persist end=start so the [from,to) window query keeps working.
  const start = input.start;
  let end: Date;
  if (input.kind === "REMINDER") {
    end = start;
  } else {
    end = input.end ?? new Date(start.getTime() + 60 * 60 * 1000);
    if (end.getTime() <= start.getTime()) {
      throw new ValidationError("end must be after start");
    }
  }

  const attendeeIds = await ensureAttendeesExist(input.attendees);
  // Owner shouldn't be in their own attendees list; the calendar implicitly
  // includes them. Strip if the FE accidentally sent it.
  const filteredAttendees = attendeeIds.filter(
    (id) => id.toString() !== ownerId,
  );

  const created = await CalendarEvent.create({
    ownerId: new Types.ObjectId(ownerId),
    kind: input.kind,
    visibility: input.visibility,
    title,
    description: input.description ?? null,
    location: input.location ?? null,
    start,
    end,
    allDay: !!input.allDay,
    reminderMinutesBefore:
      typeof input.reminderMinutesBefore === "number"
        ? input.reminderMinutesBefore
        : null,
    attendees: filteredAttendees,
  });

  // Notify each attendee (best-effort).
  if (filteredAttendees.length > 0) {
    void (async () => {
      try {
        const { notifyMany } = await import(
          "../notifications/notifications.service.js"
        );
        const owner = await User.findById(ownerId).select("name").lean<
          { name: string } | null
        >();
        await notifyMany(
          filteredAttendees.map((id) => id.toString()),
          {
            kind: "CALENDAR_INVITE",
            title:
              input.kind === "REMINDER"
                ? `Reminder added by ${owner?.name ?? "someone"}`
                : `${owner?.name ?? "Someone"} invited you to "${title}"`,
            body: input.kind === "EVENT" ? title : null,
            link: "/calendar",
          },
        );
      } catch (err) {
        logger.warn({ err }, "calendar: invite notify failed");
      }
    })();
  }

  const people = await buildPeopleMap([
    created.ownerId,
    ...filteredAttendees,
  ]);
  return denormalize(created, people);
}

export async function getEvent(
  id: string,
  viewer: { id: string; role: Role },
): Promise<CalendarEventResponseShape> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Event");
  const doc = await CalendarEvent.findById(id);
  if (!doc) throw new NotFoundError("Event");
  if (!canSee(doc, viewer)) throw new ForbiddenError();
  const people = await buildPeopleMap([doc.ownerId, ...doc.attendees]);
  return denormalize(doc, people);
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  start?: Date;
  end?: Date;
  allDay?: boolean;
  visibility?: CalendarVisibility;
  reminderMinutesBefore?: number | null;
  attendees?: string[];
}

export async function updateEvent(
  id: string,
  viewer: { id: string; role: Role },
  patch: UpdateEventInput,
): Promise<CalendarEventResponseShape> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Event");
  const doc = await CalendarEvent.findById(id);
  if (!doc) throw new NotFoundError("Event");
  if (!canManage(doc, viewer)) throw new ForbiddenError();

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new ValidationError("title is required");
    doc.title = t;
  }
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.location !== undefined) doc.location = patch.location;
  if (patch.visibility !== undefined) {
    // Promoting an event to company-wide is the same authority decision as
    // creating one: only HR/ADMIN can. Owners (who can already manage the
    // event) shouldn't be able to escalate their own private event into
    // an org-wide announcement.
    if (patch.visibility !== doc.visibility) {
      ensureCanPublishCompanyWide(patch.visibility, viewer);
    }
    doc.visibility = patch.visibility;
  }
  if (patch.allDay !== undefined) doc.allDay = patch.allDay;
  if (patch.reminderMinutesBefore !== undefined) {
    doc.reminderMinutesBefore = patch.reminderMinutesBefore;
    // Resetting the lead-time also resets the fired-at marker so the
    // reminder will re-fire if the new window slots into the future.
    doc.reminderFiredAt = null;
  }
  if (patch.start !== undefined) {
    doc.start = patch.start;
    doc.reminderFiredAt = null;
  }
  if (patch.end !== undefined) {
    doc.end = patch.end;
  }
  // Keep REMINDER end pinned to start.
  if (doc.kind === "REMINDER") {
    doc.end = doc.start;
  } else if (doc.end.getTime() <= doc.start.getTime()) {
    throw new ValidationError("end must be after start");
  }
  if (patch.attendees !== undefined) {
    validateAttendeesFormat(patch.attendees);
    const attendeeIds = await ensureAttendeesExist(patch.attendees);
    doc.attendees = attendeeIds.filter(
      (idObj) => idObj.toString() !== doc.ownerId.toString(),
    );
  }
  await doc.save();

  const people = await buildPeopleMap([doc.ownerId, ...doc.attendees]);
  return denormalize(doc, people);
}

export async function deleteEvent(
  id: string,
  viewer: { id: string; role: Role },
): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Event");
  const doc = await CalendarEvent.findById(id);
  if (!doc) throw new NotFoundError("Event");
  if (!canManage(doc, viewer)) throw new ForbiddenError();
  // Cascade: meeting notes have no meaning without their parent event, so
  // remove them in the same flow. Mongoose has no automatic cascade and a
  // dangling `eventId` would otherwise leak storage and confuse the listing
  // endpoint if the same id were ever reused.
  await MeetingNote.deleteMany({ eventId: doc._id });
  await doc.deleteOne();
}

/**
 * Scheduler-driven reminder fanout. Finds every entry where:
 *   - reminderMinutesBefore is set,
 *   - reminderFiredAt is still null (i.e. we haven't notified yet), and
 *   - the fire instant (start - leadMinutes) is in the past or now.
 *
 * Stamps `reminderFiredAt` BEFORE notifying via an atomic findOneAndUpdate
 * with a `reminderFiredAt: null` filter — that way two scheduler ticks (or
 * two replicas) racing on the same event will only see one of them claim
 * the row and the other's update will no-op. We accept the trade-off that
 * if the notify call fails after the claim, that one reminder is lost
 * rather than re-fired indefinitely; missing a reminder is preferable to
 * spamming users on every restart loop.
 */
export async function fireDueReminders(now: Date = new Date()): Promise<{
  fired: number;
}> {
  const candidates = await CalendarEvent.find({
    reminderMinutesBefore: { $ne: null },
    reminderFiredAt: null,
  }).limit(500);
  if (candidates.length === 0) return { fired: 0 };

  const { notifyMany } = await import(
    "../notifications/notifications.service.js"
  );
  let fired = 0;
  for (const candidate of candidates) {
    const lead = candidate.reminderMinutesBefore ?? 0;
    const fireAt = new Date(candidate.start.getTime() - lead * 60 * 1000);
    if (fireAt.getTime() > now.getTime()) continue;

    // Atomically claim the row. If another tick already claimed it,
    // `claimed` will be null and we skip.
    const claimed = await CalendarEvent.findOneAndUpdate(
      { _id: candidate._id, reminderFiredAt: null },
      { $set: { reminderFiredAt: now } },
      { new: true },
    );
    if (!claimed) continue;

    const recipients = [
      claimed.ownerId.toString(),
      ...claimed.attendees.map((id) => id.toString()),
    ];
    try {
      // Format in IST (the user-visible TZ for this product) so reminder
      // bodies don't render in whatever timezone the server happens to run
      // in (UTC on cloud hosts, local TZ on a dev laptop).
      const startLabel = claimed.start.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      await notifyMany(recipients, {
        kind: "CALENDAR_REMINDER",
        title:
          claimed.kind === "REMINDER"
            ? `Reminder: ${claimed.title}`
            : `Upcoming: ${claimed.title}`,
        body: `${startLabel}${claimed.location ? ` · ${claimed.location}` : ""}`,
        link: "/calendar",
      });
      fired += 1;
    } catch (err) {
      logger.warn(
        { err, eventId: claimed._id.toString() },
        "calendar reminder fanout failed for entry (claim already stamped, will not retry)",
      );
    }
  }
  return { fired };
}

// ─── Meeting notes ──────────────────────────────────────────────────────────

export interface MeetingNoteResponseShape {
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

function denormalizeNote(
  doc: MeetingNoteDoc,
  viewer: { id: string; role: Role },
  authors: Map<string, AttendeeSummary>,
): MeetingNoteResponseShape {
  const ts = doc as unknown as { createdAt: Date; updatedAt: Date };
  const authorKey = doc.authorId.toString();
  const author = authors.get(authorKey);
  return {
    id: doc._id.toString(),
    eventId: doc.eventId.toString(),
    authorId: authorKey,
    authorName: author?.name ?? null,
    authorAvatarUrl: author?.avatarUrl ?? null,
    body: doc.body,
    createdAt: ts.createdAt.toISOString(),
    updatedAt: ts.updatedAt.toISOString(),
    canManage: authorKey === viewer.id || viewer.role === "ADMIN",
  };
}

/**
 * Authorization for note-writing: the viewer must be the event owner or
 * a named attendee. Company-wide events would otherwise let any authenticated
 * user spam notes onto a meeting they have nothing to do with — explicit
 * attendee/owner check keeps the channel scoped to participants.
 */
function canWriteNotes(
  event: CalendarEventDoc,
  viewer: { id: string; role: Role },
): boolean {
  if (event.ownerId.toString() === viewer.id) return true;
  if (event.attendees.some((id) => id.toString() === viewer.id)) return true;
  return viewer.role === "ADMIN";
}

async function loadEventForNote(
  eventId: string,
  viewer: { id: string; role: Role },
): Promise<CalendarEventDoc> {
  if (!Types.ObjectId.isValid(eventId)) throw new NotFoundError("Event");
  const ev = await CalendarEvent.findById(eventId);
  if (!ev) throw new NotFoundError("Event");
  // Read-access mirrors the existing event-visibility rule. Exposing notes
  // for an event the viewer can't otherwise see would leak its existence.
  if (!canSee(ev, viewer)) throw new ForbiddenError();
  return ev;
}

export async function listNotesForEvent(
  eventId: string,
  viewer: { id: string; role: Role },
): Promise<MeetingNoteResponseShape[]> {
  await loadEventForNote(eventId, viewer);
  const docs = await MeetingNote.find({
    eventId: new Types.ObjectId(eventId),
  }).sort({ createdAt: 1 });
  const authors = await buildPeopleMap(docs.map((d) => d.authorId));
  return docs.map((d) => denormalizeNote(d, viewer, authors));
}

export async function createNote(
  eventId: string,
  viewer: { id: string; role: Role },
  body: string,
): Promise<MeetingNoteResponseShape> {
  const ev = await loadEventForNote(eventId, viewer);
  if (!canWriteNotes(ev, viewer)) {
    throw new ForbiddenError(
      "Only the event owner, attendees, or admins can add notes",
    );
  }
  const trimmed = body.trim();
  if (!trimmed) throw new ValidationError("Note body is required");
  const created = await MeetingNote.create({
    eventId: ev._id,
    authorId: new Types.ObjectId(viewer.id),
    body: trimmed,
  });
  const authors = await buildPeopleMap([created.authorId]);
  return denormalizeNote(created, viewer, authors);
}

export async function updateNote(
  noteId: string,
  viewer: { id: string; role: Role },
  body: string,
): Promise<MeetingNoteResponseShape> {
  if (!Types.ObjectId.isValid(noteId)) throw new NotFoundError("Note");
  const note = await MeetingNote.findById(noteId);
  if (!note) throw new NotFoundError("Note");
  // Edit is author-only; admins can fix typos but typically don't.
  const isAuthor = note.authorId.toString() === viewer.id;
  if (!isAuthor && viewer.role !== "ADMIN") throw new ForbiddenError();
  const trimmed = body.trim();
  if (!trimmed) throw new ValidationError("Note body is required");
  note.body = trimmed;
  await note.save();
  const authors = await buildPeopleMap([note.authorId]);
  return denormalizeNote(note, viewer, authors);
}

export async function deleteNote(
  noteId: string,
  viewer: { id: string; role: Role },
): Promise<void> {
  if (!Types.ObjectId.isValid(noteId)) throw new NotFoundError("Note");
  const note = await MeetingNote.findById(noteId);
  if (!note) throw new NotFoundError("Note");
  const isAuthor = note.authorId.toString() === viewer.id;
  if (!isAuthor && viewer.role !== "ADMIN") throw new ForbiddenError();
  await note.deleteOne();
}
