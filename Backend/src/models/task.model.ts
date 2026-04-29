import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

const taskSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 5000 },
    status: {
      type: String,
      enum: TASK_STATUSES,
      required: true,
      default: "TODO",
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      required: true,
      default: "MEDIUM",
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: { type: Date, default: null },
    parentTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: Types.ObjectId };
export type TaskModel = Model<TaskDoc>;

export const Task: TaskModel = model<TaskDoc>("Task", taskSchema);
