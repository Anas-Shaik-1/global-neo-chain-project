import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & {
  _id: Types.ObjectId;
};
export type RefreshTokenModel = Model<RefreshTokenDoc>;

export const RefreshToken: RefreshTokenModel = model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
