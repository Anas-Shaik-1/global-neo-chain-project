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
    date: {
      type: String,
      required: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"],
    },
    notes: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema> & {
  _id: Types.ObjectId;
};
export type AttendanceModel = Model<AttendanceDoc>;

export const Attendance: AttendanceModel = model<AttendanceDoc>(
  "Attendance",
  attendanceSchema,
);
