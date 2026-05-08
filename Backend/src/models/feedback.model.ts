import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

/**
 * Feedback channel for employees: a free-form way to flag a complaint or
 * propose an improvement. Two big knobs distinguish entries:
 *
 *   • `kind` (SUGGESTION | COMPLAINT) — drives copy and HR triage queue.
 *   • `isAnonymous` — submitter chose to keep their identity hidden. The
 *     `submitterId` is still recorded server-side (audit trail, abuse
 *     prevention) but the read-API redacts it for non-Admin viewers when
 *     the flag is on. Admins can lift the veil if a complaint requires
 *     follow-up; the policy is documented in the service.
 */
export const FEEDBACK_KINDS = ["SUGGESTION", "COMPLAINT"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["OPEN", "REVIEWED", "ACTIONED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

const feedbackSchema = new Schema(
  {
    submitterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isAnonymous: { type: Boolean, required: true, default: false },
    kind: {
      type: String,
      enum: FEEDBACK_KINDS,
      required: true,
    },
    /** One-line headline. */
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    /** Free-form body. Keeping the cap generous so people can write a paragraph. */
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      required: true,
      default: "OPEN",
      index: true,
    },
    /** HR/Admin's note when changing status — not visible to the submitter. */
    reviewNote: { type: String, default: null, maxlength: 1000 },
    reviewedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

feedbackSchema.index({ status: 1, createdAt: -1 });

export type FeedbackDoc = InferSchemaType<typeof feedbackSchema> & {
  _id: Types.ObjectId;
};
export type FeedbackModel = Model<FeedbackDoc>;

export const Feedback: FeedbackModel = model<FeedbackDoc>(
  "Feedback",
  feedbackSchema,
);
