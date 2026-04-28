import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// DM conversation. For MVP, exactly two participants per conversation
// (validated in the service layer). `participantIds` is stored sorted, and a
// derived `pairKey` of `min:max` user-id pair gives a unique compound index
// to prevent duplicate DM conversations between the same two people.
const conversationSchema = new Schema(
  {
    participantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
      index: true,
    },
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: null, maxlength: 100 },
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
