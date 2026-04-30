import { Types } from "mongoose";
import {
  Notification,
  type NotificationDoc,
  type NotificationKind,
} from "../../models/notification.model.js";
import { NotFoundError } from "../../lib/errors.js";

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
 * Persist a single notification for a user. Returns the created entry so
 * callers can chain (e.g. websocket fanout). Used by other services as a
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
  return denormalize(created);
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
