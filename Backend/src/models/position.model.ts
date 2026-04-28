import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";
import { EMPLOYMENT_TYPES } from "./user.model.js";

const positionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

positionSchema.index({ userId: 1, endedAt: 1 });

export type PositionDoc = InferSchemaType<typeof positionSchema> & { _id: Types.ObjectId };
export type PositionModel = Model<PositionDoc>;

export const Position: PositionModel = model<PositionDoc>("Position", positionSchema);
