import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// Short-lived password reset tokens. We never store the raw token: only its
// sha256 hash. Mongo TTL on `expiresAt` deletes expired entries automatically.
const passwordResetTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    // TTL index: Mongo deletes the doc once expiresAt is reached.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema> & {
  _id: Types.ObjectId;
};
export type PasswordResetTokenModel = Model<PasswordResetTokenDoc>;

export const PasswordResetToken: PasswordResetTokenModel = model<PasswordResetTokenDoc>(
  "PasswordResetToken",
  passwordResetTokenSchema,
);
