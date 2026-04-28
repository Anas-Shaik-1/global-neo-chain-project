import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 30,
      match: [/^[a-z0-9-]+$/, "code must be lowercase alphanumeric or hyphens"],
    },
    description: { type: String, default: null, maxlength: 500 },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export type DepartmentDoc = InferSchemaType<typeof departmentSchema> & { _id: Types.ObjectId };
export type DepartmentModel = Model<DepartmentDoc>;

export const Department: DepartmentModel = model<DepartmentDoc>("Department", departmentSchema);
