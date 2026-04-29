import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const TASK_ACTIVITY_KINDS = [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "PRIORITY_CHANGED",
  "DUE_DATE_CHANGED",
  "TITLE_CHANGED",
  "COMMENTED",
] as const;
export type TaskActivityKind = (typeof TASK_ACTIVITY_KINDS)[number];

const taskActivitySchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: {
      type: String,
      enum: TASK_ACTIVITY_KINDS,
      required: true,
    },
    fromValue: { type: String, default: null },
    toValue: { type: String, default: null },
    summary: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type TaskActivityDoc = InferSchemaType<typeof taskActivitySchema> & { _id: Types.ObjectId };
export const TaskActivity: Model<TaskActivityDoc> = model<TaskActivityDoc>(
  "TaskActivity",
  taskActivitySchema,
);
