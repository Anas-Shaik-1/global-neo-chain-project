import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

/**
 * A single note attached to a calendar event. Multiple notes per event are
 * intentional — different attendees can each drop their own observations
 * during or after the meeting, the way real teams take minutes. The list
 * survives the meeting itself: notes are read-back any time someone opens
 * the event detail, and they're scoped to the event's visibility (if you
 * can see the event, you can read its notes).
 *
 * Author + timestamps drive the audit trail. Edit / delete is owner-or-
 * admin (enforced in the service).
 */
const meetingNoteSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "CalendarEvent",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true },
);

meetingNoteSchema.index({ eventId: 1, createdAt: 1 });

export type MeetingNoteDoc = InferSchemaType<typeof meetingNoteSchema> & {
  _id: Types.ObjectId;
};
export type MeetingNoteModel = Model<MeetingNoteDoc>;

export const MeetingNote: MeetingNoteModel = model<MeetingNoteDoc>(
  "MeetingNote",
  meetingNoteSchema,
);
