import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

const taskCommentSchema = new Schema(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type TaskCommentDoc = InferSchemaType<typeof taskCommentSchema> & { _id: Types.ObjectId };
export type TaskCommentModel = Model<TaskCommentDoc>;

export const TaskComment: TaskCommentModel = model<TaskCommentDoc>(
  "TaskComment",
  taskCommentSchema,
);
