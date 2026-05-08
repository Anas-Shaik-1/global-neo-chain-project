import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

/**
 * Calendar entries cover two related but distinct things:
 *
 *   - EVENT: a meeting / off-site / etc. with a start + end window. Owner
 *     can attach attendees and a location/url. Default visibility is
 *     `team` — visible to attendees + the owner.
 *
 *   - REMINDER: a single point-in-time nudge. The `start` timestamp is the
 *     fire time; `end` is set to the same value at write-time. Used for
 *     personal "ping me about X" prompts.
 *
 * Visibility shapes who can see the entry on /calendar:
 *   - `private`: owner-only
 *   - `team`:    owner + named attendees
 *   - `company`: any authenticated user
 *
 * `reminderFiredAt` is stamped by the background scheduler the first time
 * a reminder notification is emitted, so we never double-notify.
 */
export const CALENDAR_EVENT_KINDS = ["EVENT", "REMINDER"] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export const CALENDAR_VISIBILITIES = ["private", "team", "company"] as const;
export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];

const calendarEventSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: CALENDAR_EVENT_KINDS,
      required: true,
      default: "EVENT",
      index: true,
    },
    visibility: {
      type: String,
      enum: CALENDAR_VISIBILITIES,
      required: true,
      default: "team",
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 2000 },
    location: { type: String, default: null, trim: true, maxlength: 300 },
    /** Inclusive start of the event/reminder. */
    start: { type: Date, required: true, index: true },
    /** Inclusive end. For REMINDER kinds, equal to `start`. */
    end: { type: Date, required: true },
    /** True for full-day events; FE clamps the time portion. */
    allDay: { type: Boolean, required: true, default: false },
    /**
     * Optional reminder lead-time in minutes. When set, the scheduler emits
     * a notification N minutes before `start`. 0 means "fire at start".
     * Null disables the reminder side-channel entirely; users still see
     * the entry on the calendar.
     */
    reminderMinutesBefore: { type: Number, default: null, min: 0 },
    /** Idempotency marker for the scheduler — set on first notification. */
    reminderFiredAt: { type: Date, default: null, index: true },
    attendees: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      default: [],
      index: true,
    },
  },
  { timestamps: true },
);

calendarEventSchema.index({ start: 1, end: 1 });
calendarEventSchema.index({ ownerId: 1, start: 1 });

// Reject inverted windows (end before start). REMINDER kinds set end===start
// at write-time, so equality is allowed.
calendarEventSchema.pre("validate", function (next) {
  if (this.start && this.end && this.end.getTime() < this.start.getTime()) {
    return next(
      this.invalidate(
        "end",
        "end must be on or after start",
        this.end,
      ) as unknown as Error,
    );
  }
  next();
});

export type CalendarEventDoc = InferSchemaType<typeof calendarEventSchema> & {
  _id: Types.ObjectId;
};
export type CalendarEventModel = Model<CalendarEventDoc>;

export const CalendarEvent: CalendarEventModel = model<CalendarEventDoc>(
  "CalendarEvent",
  calendarEventSchema,
);
