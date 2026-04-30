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

export const CALL_KINDS = ["DIRECT", "GROUP"] as const;
export type CallKind = (typeof CALL_KINDS)[number];

// Call session: 2..N participants connected via mesh WebRTC. For 1-1 calls
// (kind="DIRECT") participantIds has 2 entries (initiator + the other person).
// For group calls (kind="GROUP") participantIds has 3..4 entries — mesh
// topology means we keep this small (documented MVP cap of 4 total).
const callSessionSchema = new Schema(
  {
    participantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
      index: true,
    },
    initiatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: CALL_KINDS,
      required: true,
      default: "DIRECT",
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

callSessionSchema.index({ initiatorId: 1, createdAt: -1 });
callSessionSchema.index({ participantIds: 1, createdAt: -1 });

export type CallSessionDoc = InferSchemaType<typeof callSessionSchema> & {
  _id: Types.ObjectId;
};
export type CallSessionModel = Model<CallSessionDoc>;

export const CallSession: CallSessionModel = model<CallSessionDoc>(
  "CallSession",
  callSessionSchema,
);
