import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const NOTIFICATION_KINDS = [
  "EXPENSE_SUBMITTED",
  "EXPENSE_APPROVED",
  "EXPENSE_REJECTED",
  "PAYSLIP_AVAILABLE",
  "TASK_ASSIGNED",
  "EMPLOYEE_VERIFIED",
  "DEPARTMENT_ASSIGNMENT",
  "PROMOTED_TO_PM",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: null, maxlength: 500 },
    link: { type: String, default: null }, // FE route to navigate to
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & {
  _id: Types.ObjectId;
};
export const Notification: Model<NotificationDoc> = model<NotificationDoc>(
  "Notification",
  notificationSchema,
);
