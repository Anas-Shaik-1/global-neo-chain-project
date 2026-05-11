import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// Typed leave request. Day-precision dates stored at UTC midnight so
// overlap checks aren't skewed by the client's timezone. No balances,
// no half-days — those are deferred to a future iteration.
const leaveRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },
    decisionById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decisionAt: { type: Date, default: null },
    decisionNotes: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

leaveRequestSchema.index({ userId: 1, status: 1 });
leaveRequestSchema.index({ status: 1, startDate: 1 });

export type LeaveRequestDoc = InferSchemaType<typeof leaveRequestSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type LeaveRequestModel = Model<LeaveRequestDoc>;

export const LeaveRequest: LeaveRequestModel = model<LeaveRequestDoc>(
  "LeaveRequest",
  leaveRequestSchema,
);
