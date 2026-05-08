import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const NOTIFICATION_KINDS = [
  "EXPENSE_SUBMITTED",
  "EXPENSE_APPROVED",
  "EXPENSE_REJECTED",
  "PAYSLIP_AVAILABLE",
  "TASK_ASSIGNED",
  "TASK_COMMENTED",
  "EMPLOYEE_VERIFIED",
  "EMPLOYEE_DEACTIVATED",
  "DEPARTMENT_ASSIGNMENT",
  "PROMOTED_TO_PM",
  "DEMOTED_FROM_PM",
  "CANDIDATE_AWAITING_REVIEW",
  "CANDIDATE_HR_APPROVED",
  "CANDIDATE_REJECTED",
  "CANDIDATE_REGISTERED",
  "CALL_MISSED",
  "BUG_ASSIGNED",
  "BUG_RESOLVED",
  "TWO_FA_ENABLED",
  "TWO_FA_DISABLED",
  "PASSWORD_CHANGED",
  // Attendance flows
  "ATTENDANCE_REMINDER",
  "ATTENDANCE_EDITED",
  "ATTENDANCE_AUTO_CHECKOUT",
  // Chat
  "NEW_MESSAGE",
  // Feedback (suggestions / complaints)
  "FEEDBACK_SUBMITTED",
  // Calendar
  "CALENDAR_INVITE",
  "CALENDAR_REMINDER",
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
