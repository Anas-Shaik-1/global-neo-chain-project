import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

/**
 * Bug status workflow — open by default, marked fixed when the team's
 * resolved it. Kept simple on purpose; if QA needs a richer flow later
 * this is the right place to extend.
 */
export const BUG_STATUSES = ["OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

const bugSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },

    /**
     * Branch-friendly slug derived from the title plus a short random
     * suffix for uniqueness, e.g. `login-button-broken-a3f4`. Devs use it
     * verbatim as a git branch name (`git checkout -b fix/<code>`), so we
     * enforce lowercase + alphanumerics + hyphens at the schema level.
     */
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 80,
      match: [/^[a-z0-9-]+$/, "code must be lowercase alphanumeric or hyphens"],
    },

    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },

    /** Optional screenshot/attachment URL — relative to the storage driver. */
    imageUrl: { type: String, default: null },

    status: {
      type: String,
      enum: BUG_STATUSES,
      required: true,
      default: "OPEN",
    },

    /** The user who filed the bug. Used for ownership checks on edit. */
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /**
     * Optional project this bug belongs to. Lets the engineering team filter
     * the tracker by surface (frontend/backend/etc.) and lets a bug travel
     * with its project on dashboards. Sparse index because bugs filed before
     * this column existed (and bugs that deliberately span projects) leave
     * it null.
     */
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },

    /**
     * Optional link to the task created to fix this bug. Set by the
     * "Create task" action on the bug detail; lets the FE render a chip
     * pointing at the active fix and lets dashboards roll up bugs with
     * their fix-tasks. Sparse since most bugs aren't linked yet.
     */
    linkedTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

bugSchema.index({ createdAt: -1 });

export type BugDoc = InferSchemaType<typeof bugSchema> & { _id: Types.ObjectId };
export type BugModel = Model<BugDoc>;

export const Bug: BugModel = model<BugDoc>("Bug", bugSchema);
