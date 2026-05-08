import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// Append-only chat message belonging to a conversation.
// A message has either a text body, or an attachment, or both.
const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: false, default: "", maxlength: 4000 },
    attachmentUrl: { type: String, default: null },
    attachmentKey: { type: String, default: null, select: false },
    attachmentName: { type: String, default: null, maxlength: 200 },
    attachmentMimeType: { type: String, default: null, maxlength: 100 },
    attachmentSize: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Compound index for paginated reads of a conversation's history.
messageSchema.index({ conversationId: 1, createdAt: -1 });

// A message must have either a non-empty body or an attachment.
messageSchema.pre("validate", function (next) {
  const hasBody = typeof this.body === "string" && this.body.length > 0;
  const hasAttachment = Boolean(this.attachmentUrl);
  if (!hasBody && !hasAttachment) {
    return next(
      this.invalidate(
        "body",
        "Message must have a non-empty body or an attachment",
        this.body,
      ) as unknown as Error,
    );
  }
  next();
});

export type MessageDoc = InferSchemaType<typeof messageSchema> & {
  _id: Types.ObjectId;
};
export type MessageModel = Model<MessageDoc>;

export const Message: MessageModel = model<MessageDoc>("Message", messageSchema);
