import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 30,
      match: [/^[a-z0-9-]+$/, "key must be lowercase alphanumeric or hyphens"],
    },
    description: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

export type ProjectDoc = InferSchemaType<typeof projectSchema> & { _id: Types.ObjectId };
export type ProjectModel = Model<ProjectDoc>;

export const Project: ProjectModel = model<ProjectDoc>("Project", projectSchema);
