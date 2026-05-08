import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const CONVERSATION_KINDS = ["DM", "GROUP"] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

// Conversation: either a 2-person DM (kind="DM") or an N-person group
// (kind="GROUP"). For DMs, `participantIds` is stored sorted, and a derived
// `pairKey` of `min:max` user-id pair gives a unique sparse index to prevent
// duplicate DMs between the same pair. Groups have pairKey=null and are not
// deduped — multiple groups between the same set of people are allowed.
const conversationSchema = new Schema(
  {
    kind: {
      type: String,
      enum: CONVERSATION_KINDS,
      required: true,
      default: "DM",
      index: true,
    },
    name: {
      type: String,
      default: null,
      maxlength: 100,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    participantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
      index: true,
      validate: {
        validator: (v: Types.ObjectId[]) =>
          Array.isArray(v) && v.length >= 2 && v.length <= 50,
        message: "participantIds must contain between 2 and 50 users",
      },
    },
    // Sparse so that GROUP docs with pairKey=null don't violate uniqueness.
    pairKey: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: null, maxlength: 100 },
    /**
     * Per-participant "I have read up to this timestamp" marker. Updated
     * when a user opens the conversation in the FE; queried alongside the
     * Message collection to compute unread counts. Map of stringified userId
     * → Date.
     */
    lastReadByParticipant: {
      type: Map,
      of: Date,
      default: undefined,
    },
  },
  { timestamps: true },
);

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & {
  _id: Types.ObjectId;
};
export type ConversationModel = Model<ConversationDoc>;

export const Conversation: ConversationModel = model<ConversationDoc>(
  "Conversation",
  conversationSchema,
);

export function buildPairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
