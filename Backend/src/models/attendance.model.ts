import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const attendanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date, default: null },
    lunchStart: { type: Date, default: null },
    lunchEnd: { type: Date, default: null },
    isRemote: { type: Boolean, default: false },
    date: {
      type: String,
      required: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"],
    },
    notes: { type: String, default: null, maxlength: 500 },
    /**
     * Admin-marked absence flag. When true, clockIn/clockOut are stamped at
     * the entry's date midnight (so the schema's required clockIn invariant
     * holds) and duration is reported as 0. Defaults to false; toggled only
     * via the admin attendance edit endpoint.
     */
    isAbsent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Sanity-check chronological ordering of clock + lunch timestamps before save.
attendanceSchema.pre("validate", function (next) {
  if (this.clockIn && this.clockOut && this.clockOut.getTime() <= this.clockIn.getTime()) {
    return next(
      this.invalidate(
        "clockOut",
        "clockOut must be strictly after clockIn",
        this.clockOut,
      ) as unknown as Error,
    );
  }
  if (
    this.lunchStart &&
    this.lunchEnd &&
    this.lunchEnd.getTime() <= this.lunchStart.getTime()
  ) {
    return next(
      this.invalidate(
        "lunchEnd",
        "lunchEnd must be strictly after lunchStart",
        this.lunchEnd,
      ) as unknown as Error,
    );
  }
  next();
});

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema> & {
  _id: Types.ObjectId;
};
export type AttendanceModel = Model<AttendanceDoc>;

export const Attendance: AttendanceModel = model<AttendanceDoc>(
  "Attendance",
  attendanceSchema,
);
