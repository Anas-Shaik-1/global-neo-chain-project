import { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const ROLES = ["ADMIN", "HR", "EMPLOYEE", "PM"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "EMPLOYEE" },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import("mongoose").Types.ObjectId };
export type UserModel = Model<UserDoc>;

export const User: UserModel = model<UserDoc>("User", userSchema);
