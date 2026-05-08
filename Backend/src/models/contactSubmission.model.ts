import { Schema, model, type Document, type Types } from "mongoose";

/**
 * One row per landing-page contact-form submission. We persist these
 * (rather than fire-and-forget the email) so that an SMTP outage never
 * loses an inbound enquiry — the row is the source of truth, the email is
 * a notification on top.
 */
export interface ContactSubmissionDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  company: string | null;
  message: string;
  /** Captured for spam triage; null if not provided by the proxy. */
  ipAddress: string | null;
  userAgent: string | null;
  /** Set once the notification email has been dispatched. */
  notifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contactSubmissionSchema = new Schema<ContactSubmissionDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
      index: true,
    },
    company: { type: String, trim: true, maxlength: 100, default: null },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    ipAddress: { type: String, default: null, maxlength: 64 },
    userAgent: { type: String, default: null, maxlength: 400 },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Recent-first listing index for an admin moderation queue down the line.
contactSubmissionSchema.index({ createdAt: -1 });

export const ContactSubmission = model<ContactSubmissionDoc>(
  "ContactSubmission",
  contactSubmissionSchema,
);
