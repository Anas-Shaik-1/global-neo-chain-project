import { Types } from "mongoose";
import {
  Notification,
  type NotificationDoc,
  type NotificationKind,
} from "../../models/notification.model.js";
import { NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { getChatNamespace } from "../../realtime/index.js";

export interface NotificationResponseShape {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function denormalize(n: NotificationDoc): NotificationResponseShape {
  const ts = n as unknown as { createdAt: Date };
  return {
    id: n._id.toString(),
    userId: n.userId.toString(),
    kind: n.kind as NotificationKind,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: ts.createdAt.toISOString(),
  };
}

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Push a "notification:new" event to every connected socket the user owns
 * (across tabs / devices) so the FE can refresh without polling. Best-effort:
 * if the chat namespace isn't attached (e.g., during early boot or in a unit
 * test without sockets), we no-op.
 */
function pushRealtime(
  userId: string,
  payload: NotificationResponseShape,
): void {
  try {
    const ns = getChatNamespace();
    if (!ns) return;
    ns.to(`user:${userId}`).emit("notification:new", payload);
  } catch (err) {
    logger.warn({ err, userId }, "notifications realtime push failed");
  }
}

/**
 * Persist a single notification for a user and emit a realtime event so any
 * connected sockets see it immediately. Used by other services as a
 * fire-and-forget; callers should swallow errors at the call site so the
 * primary business flow keeps succeeding.
 */
export async function notify(
  userId: string,
  input: NotifyInput,
): Promise<NotificationResponseShape> {
  const created = await Notification.create({
    userId: new Types.ObjectId(userId),
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    readAt: null,
  });
  const payload = denormalize(created);
  pushRealtime(userId, payload);
  return payload;
}

/**
 * Bulk variant: one Mongo insertMany + per-user realtime push. Use when
 * fanning out the SAME notification to many recipients (e.g. notify all
 * admins of a new candidate). Skips empty arrays. De-dupes ids defensively
 * so a duplicated `userIds` doesn't create two records for the same person.
 */
export async function notifyMany(
  userIds: string[],
  input: NotifyInput,
): Promise<NotificationResponseShape[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const docs = await Notification.insertMany(
    unique.map((id) => ({
      userId: new Types.ObjectId(id),
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      readAt: null,
    })),
  );
  const out = docs.map((d) => denormalize(d as NotificationDoc));
  for (const payload of out) pushRealtime(payload.userId, payload);
  return out;
}

export interface ListMineInput {
  unread?: boolean;
  limit?: number;
}

export async function listMine(
  userId: string,
  input: ListMineInput,
): Promise<NotificationResponseShape[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (input.unread) filter.readAt = null;
  const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
  return docs.map(denormalize);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({
    userId: new Types.ObjectId(userId),
    readAt: null,
  });
}

export async function markRead(
  userId: string,
  id: string,
): Promise<NotificationResponseShape> {
  const doc = await Notification.findOneAndUpdate(
    { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!doc) throw new NotFoundError("Notification");
  return denormalize(doc);
}

export async function markAllRead(userId: string): Promise<{ count: number }> {
  const res = await Notification.updateMany(
    { userId: new Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { count: res.modifiedCount ?? 0 };
}
