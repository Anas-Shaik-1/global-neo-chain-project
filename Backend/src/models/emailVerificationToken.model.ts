import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// Short-lived email verification tokens. We never store the raw token: only its
// sha256 hash. Mongo TTL on `expiresAt` deletes expired entries automatically.
const emailVerificationTokenSchema = new Schema(
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
      // Defence in depth: a leaky `.find().lean()` won't exfiltrate the hash.
      // The service already projects this in explicitly via findOne({ tokenHash }).
      select: false,
    },
    // TTL index: Mongo deletes the doc once expiresAt is reached.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type EmailVerificationTokenDoc = InferSchemaType<typeof emailVerificationTokenSchema> & {
  _id: Types.ObjectId;
};
export type EmailVerificationTokenModel = Model<EmailVerificationTokenDoc>;

export const EmailVerificationToken: EmailVerificationTokenModel =
  model<EmailVerificationTokenDoc>("EmailVerificationToken", emailVerificationTokenSchema);
