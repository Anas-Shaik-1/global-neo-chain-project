import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const CALL_STATUSES = [
  "INVITED",
  "ACTIVE",
  "ENDED",
  "REJECTED",
  "MISSED",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_END_REASONS = ["HANGUP", "REJECT", "TIMEOUT", "ERROR"] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

const callSessionSchema = new Schema(
  {
    callerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    calleeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: CALL_STATUSES,
      required: true,
      default: "INVITED",
    },
    startedAt: { type: Date, required: true, default: Date.now },
    acceptedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endReason: {
      type: String,
      enum: [...CALL_END_REASONS, null],
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

callSessionSchema.index({ callerId: 1, createdAt: -1 });
callSessionSchema.index({ calleeId: 1, createdAt: -1 });

export type CallSessionDoc = InferSchemaType<typeof callSessionSchema> & {
  _id: Types.ObjectId;
};
export type CallSessionModel = Model<CallSessionDoc>;

export const CallSession: CallSessionModel = model<CallSessionDoc>(
  "CallSession",
  callSessionSchema,
);
