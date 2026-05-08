import { Types } from "mongoose";
import {
  Feedback,
  type FeedbackDoc,
  type FeedbackKind,
  type FeedbackStatus,
} from "../../models/feedback.model.js";
import { User, type Role } from "../../models/user.model.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export interface FeedbackResponseShape {
  id: string;
  kind: FeedbackKind;
  subject: string;
  body: string;
  status: FeedbackStatus;
  isAnonymous: boolean;
  /** Always null when isAnonymous + viewer is not elevated. */
  submitterId: string | null;
  submitterName: string | null;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * HR + Admin can read every entry, including the submitter behind an
 * anonymous flag (HR triage often needs identity to follow up). Non-elevated
 * viewers see anonymous submissions stripped of identifying fields. The
 * submitter themselves always sees their own row in full.
 */
function isElevated(role: Role): boolean {
  return role === "HR" || role === "ADMIN";
}

function denormalize(
  doc: FeedbackDoc,
  viewer: { id: string; role: Role },
  names: Map<string, string>,
): FeedbackResponseShape {
  const ts = doc as unknown as { createdAt: Date; updatedAt: Date };
  const isOwn = doc.submitterId.toString() === viewer.id;
  const showIdentity = !doc.isAnonymous || isElevated(viewer.role) || isOwn;
  return {
    id: doc._id.toString(),
    kind: doc.kind as FeedbackKind,
    subject: doc.subject,
    body: doc.body,
    status: doc.status as FeedbackStatus,
    isAnonymous: !!doc.isAnonymous,
    submitterId: showIdentity ? doc.submitterId.toString() : null,
    submitterName: showIdentity
      ? names.get(doc.submitterId.toString()) ?? null
      : null,
    reviewNote: isElevated(viewer.role) ? doc.reviewNote ?? null : null,
    reviewedById: doc.reviewedById ? doc.reviewedById.toString() : null,
    reviewedByName: doc.reviewedById
      ? names.get(doc.reviewedById.toString()) ?? null
      : null,
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    createdAt: ts.createdAt.toISOString(),
    updatedAt: ts.updatedAt.toISOString(),
  };
}

async function buildNames(ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(ids.map((i) => (i ? i.toString() : "")).filter(Boolean)),
  );
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const users = await User.find({
    _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
  })
    .select("name")
    .lean<{ _id: Types.ObjectId; name: string }[]>();
  for (const u of users) map.set(u._id.toString(), u.name);
  return map;
}

export interface SubmitFeedbackInput {
  kind: FeedbackKind;
  subject: string;
  body: string;
  isAnonymous: boolean;
}

/**
 * Persist a new piece of feedback. The submitter is always recorded
 * server-side regardless of `isAnonymous` — the flag only controls whether
 * non-elevated readers can see who filed it.
 *
 * After save, fan a notification out to every active HR + Admin so the
 * triage queue is timely. Anonymous submissions still notify (so HR knows
 * something landed), but the notification body is anonymised.
 */
export async function submitFeedback(
  submitterId: string,
  input: SubmitFeedbackInput,
): Promise<FeedbackResponseShape> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new ValidationError("subject is required");
  if (!body) throw new ValidationError("body is required");

  const created = await Feedback.create({
    submitterId: new Types.ObjectId(submitterId),
    isAnonymous: input.isAnonymous,
    kind: input.kind,
    subject,
    body,
  });

  // Fan-out notification (best-effort).
  void (async () => {
    try {
      const [{ notifyMany }, recipients] = await Promise.all([
        import("../notifications/notifications.service.js"),
        User.find({
          role: { $in: ["HR", "ADMIN"] },
          isActive: true,
          approvalStatus: "ACTIVE",
        })
          .select("_id")
          .lean<{ _id: Types.ObjectId }[]>(),
      ]);
      const submitter = await User.findById(submitterId).select("name").lean<
        { name: string } | null
      >();
      const titlePrefix =
        input.kind === "SUGGESTION" ? "New suggestion" : "New complaint";
      const author = input.isAnonymous
        ? "an anonymous teammate"
        : submitter?.name ?? "a teammate";
      await notifyMany(
        recipients.map((r) => r._id.toString()),
        {
          kind: "FEEDBACK_SUBMITTED",
          title: `${titlePrefix} from ${author}`,
          body: subject,
          link: "/feedback",
        },
      );
    } catch (err) {
      logger.warn({ err }, "feedback: notify HR/Admin failed");
    }
  })();

  const names = await buildNames([
    created.submitterId,
    ...(created.reviewedById ? [created.reviewedById] : []),
  ]);
  return denormalize(created, { id: submitterId, role: "EMPLOYEE" }, names);
}

export interface ListFeedbackInput {
  /** Filter to entries the requester submitted. Default false = all visible to elevated; for non-elevated, always treated as `mine`. */
  mine?: boolean;
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  page?: number;
  limit?: number;
}

export async function listFeedback(
  viewer: { id: string; role: Role },
  input: ListFeedbackInput,
): Promise<{
  items: FeedbackResponseShape[];
  total: number;
  page: number;
  limit: number;
}> {
  const elevated = isElevated(viewer.role);
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = {};
  // Non-elevated viewers can only see their own entries — anonymous or not.
  if (!elevated || input.mine) {
    filter.submitterId = new Types.ObjectId(viewer.id);
  }
  if (input.status) filter.status = input.status;
  if (input.kind) filter.kind = input.kind;

  const [docs, total] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Feedback.countDocuments(filter),
  ]);

  const ids: Types.ObjectId[] = [];
  for (const d of docs) {
    ids.push(d.submitterId);
    if (d.reviewedById) ids.push(d.reviewedById);
  }
  const names = await buildNames(ids);
  return {
    items: docs.map((d) => denormalize(d, viewer, names)),
    total,
    page,
    limit,
  };
}

export async function getFeedback(
  id: string,
  viewer: { id: string; role: Role },
): Promise<FeedbackResponseShape> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Feedback");
  const doc = await Feedback.findById(id);
  if (!doc) throw new NotFoundError("Feedback");
  const ownerId = doc.submitterId.toString();
  if (!isElevated(viewer.role) && ownerId !== viewer.id) {
    throw new ForbiddenError();
  }
  const names = await buildNames(
    [doc.submitterId, doc.reviewedById].filter(
      (i): i is Types.ObjectId => !!i,
    ),
  );
  return denormalize(doc, viewer, names);
}

export interface ReviewFeedbackInput {
  status: FeedbackStatus;
  reviewNote?: string;
}

/**
 * HR/Admin moves an entry through OPEN → REVIEWED → ACTIONED. Optional note
 * is stored against the entry for the audit trail; the note is NOT shown to
 * the submitter (elevated-only field on the response).
 */
export async function reviewFeedback(
  id: string,
  reviewer: { id: string; role: Role },
  input: ReviewFeedbackInput,
): Promise<FeedbackResponseShape> {
  if (!isElevated(reviewer.role)) throw new ForbiddenError();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Feedback");
  const doc = await Feedback.findById(id);
  if (!doc) throw new NotFoundError("Feedback");
  doc.status = input.status;
  doc.reviewNote = input.reviewNote ?? null;
  doc.reviewedById = new Types.ObjectId(reviewer.id);
  doc.reviewedAt = new Date();
  await doc.save();
  const names = await buildNames(
    [doc.submitterId, doc.reviewedById].filter(
      (i): i is Types.ObjectId => !!i,
    ),
  );
  return denormalize(doc, reviewer, names);
}
