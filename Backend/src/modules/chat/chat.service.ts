import { Types } from "mongoose";
import {
  Conversation,
  buildPairKey,
  type ConversationDoc,
  type ConversationKind,
} from "../../models/conversation.model.js";
import { Message, type MessageDoc } from "../../models/message.model.js";
import { User } from "../../models/user.model.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { createFileStorage, type FileInput } from "../../lib/storage.js";

const storage = createFileStorage();

export interface ParticipantSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ConversationResponseShape {
  id: string;
  kind: ConversationKind;
  name: string | null;
  createdById: string | null;
  participants: ParticipantSummary[];
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface MessageResponseShape {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: Date;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
}

async function buildParticipantsMap(
  ids: Types.ObjectId[],
): Promise<Map<string, ParticipantSummary>> {
  const unique = Array.from(new Set(ids.map((i) => i.toString())));
  const map = new Map<string, ParticipantSummary>();
  if (unique.length === 0) return map;
  const users = await User.find({ _id: { $in: unique } })
    .select("name avatarUrl")
    .lean();
  for (const u of users) {
    map.set(u._id.toString(), {
      id: u._id.toString(),
      name: u.name,
      avatarUrl: u.avatarUrl ?? null,
    });
  }
  // For any ID we couldn't find (e.g. deleted user), leave a placeholder so
  // the response still validates.
  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, { id, name: "Unknown", avatarUrl: null });
    }
  }
  return map;
}

export function denormalizeConversation(
  c: ConversationDoc,
  participants: Map<string, ParticipantSummary>,
): ConversationResponseShape {
  return {
    id: c._id.toString(),
    kind: (c.kind ?? "DM") as ConversationKind,
    name: c.name ?? null,
    createdById: c.createdById ? c.createdById.toString() : null,
    participants: c.participantIds.map(
      (id) =>
        participants.get(id.toString()) ?? {
          id: id.toString(),
          name: "Unknown",
          avatarUrl: null,
        },
    ),
    lastMessageAt: c.lastMessageAt ?? null,
    lastMessagePreview: c.lastMessagePreview ?? null,
    unreadCount: 0,
  };
}

async function buildAuthorNames(
  ids: Types.ObjectId[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.map((i) => i.toString())));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  for (const u of users) map.set(u._id.toString(), u.name);
  return map;
}

export function denormalizeMessage(
  m: MessageDoc,
  authors: Map<string, string>,
): MessageResponseShape {
  const ts = m as unknown as { createdAt: Date };
  return {
    id: m._id.toString(),
    conversationId: m.conversationId.toString(),
    authorId: m.authorId.toString(),
    authorName: authors.get(m.authorId.toString()) ?? null,
    body: m.body ?? "",
    createdAt: ts.createdAt,
    attachmentUrl: m.attachmentUrl ?? null,
    attachmentName: m.attachmentName ?? null,
    attachmentMimeType: m.attachmentMimeType ?? null,
    attachmentSize: m.attachmentSize ?? null,
  };
}

export async function openConversation(
  meId: string,
  otherUserId: string,
): Promise<ConversationResponseShape> {
  if (meId === otherUserId) {
    throw new ValidationError("Cannot open a DM with yourself");
  }
  if (!Types.ObjectId.isValid(otherUserId)) {
    throw new ValidationError("otherUserId must be a valid id");
  }
  const other = await User.findById(otherUserId).select("_id").lean();
  if (!other) throw new NotFoundError("User");

  const pairKey = buildPairKey(meId, otherUserId);
  const sortedIds =
    meId < otherUserId
      ? [new Types.ObjectId(meId), new Types.ObjectId(otherUserId)]
      : [new Types.ObjectId(otherUserId), new Types.ObjectId(meId)];

  let convo = await Conversation.findOne({ pairKey });
  if (!convo) {
    try {
      convo = await Conversation.create({
        kind: "DM",
        participantIds: sortedIds,
        pairKey,
        lastMessageAt: null,
        lastMessagePreview: null,
      });
    } catch (err: unknown) {
      // Race: someone else inserted the same pair concurrently.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: number }).code === 11000
      ) {
        const existing = await Conversation.findOne({ pairKey });
        if (existing) {
          convo = existing;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  const participants = await buildParticipantsMap(convo!.participantIds);
  return denormalizeConversation(convo!, participants);
}

export async function listConversations(
  meId: string,
): Promise<ConversationResponseShape[]> {
  const docs = await Conversation.find({
    participantIds: new Types.ObjectId(meId),
  }).sort({ lastMessageAt: -1, updatedAt: -1 });

  const allIds: Types.ObjectId[] = [];
  for (const d of docs) {
    for (const id of d.participantIds) allIds.push(id);
  }
  const participants = await buildParticipantsMap(allIds);
  return docs.map((d) => denormalizeConversation(d, participants));
}

export interface CreateGroupInput {
  name: string;
  participantIds: string[]; // 1+ other users; creator added automatically if missing
}

export async function createGroup(
  creatorId: string,
  input: CreateGroupInput,
): Promise<ConversationResponseShape> {
  const trimmedName = (input.name ?? "").trim();
  if (!trimmedName) throw new ValidationError("Group name is required");
  if (trimmedName.length > 100) throw new ValidationError("Group name too long");

  if (!Types.ObjectId.isValid(creatorId)) {
    throw new ValidationError("creatorId must be a valid id");
  }
  for (const id of input.participantIds) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError("participantIds must contain valid ids");
    }
  }

  const allIds = Array.from(new Set([creatorId, ...input.participantIds]));
  if (allIds.length < 2) {
    throw new ValidationError("A group needs at least 2 participants");
  }

  // Validate all users exist.
  const users = await User.find({
    _id: { $in: allIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean();
  if (users.length !== allIds.length) {
    throw new ValidationError("One or more participants don't exist");
  }

  const conv = await Conversation.create({
    kind: "GROUP",
    name: trimmedName,
    participantIds: allIds.map((id) => new Types.ObjectId(id)),
    createdById: new Types.ObjectId(creatorId),
    pairKey: null,
  });

  const participants = await buildParticipantsMap(conv.participantIds);
  return denormalizeConversation(conv, participants);
}

export async function addGroupMember(
  conversationId: string,
  requesterId: string,
  userId: string,
): Promise<ConversationResponseShape> {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError("conversationId must be a valid id");
  }
  if (!Types.ObjectId.isValid(userId)) {
    throw new ValidationError("userId must be a valid id");
  }
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new NotFoundError("Conversation");
  if (conv.kind !== "GROUP") {
    throw new ValidationError("Cannot add members to a DM");
  }
  const requesterIsMember = conv.participantIds.some(
    (id) => id.toString() === requesterId,
  );
  if (!requesterIsMember) {
    throw new ForbiddenError("Only group members can add others");
  }

  // Validate the candidate user exists.
  const candidate = await User.findById(userId).select("_id").lean();
  if (!candidate) throw new NotFoundError("User");

  const alreadyMember = conv.participantIds.some(
    (id) => id.toString() === userId,
  );
  if (!alreadyMember) {
    conv.participantIds.push(new Types.ObjectId(userId));
    await conv.save();
  }

  const participants = await buildParticipantsMap(conv.participantIds);
  return denormalizeConversation(conv, participants);
}

export async function removeGroupMember(
  conversationId: string,
  requesterId: string,
  userId: string,
): Promise<ConversationResponseShape> {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError("conversationId must be a valid id");
  }
  if (!Types.ObjectId.isValid(userId)) {
    throw new ValidationError("userId must be a valid id");
  }
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new NotFoundError("Conversation");
  if (conv.kind !== "GROUP") {
    throw new ValidationError("Cannot remove members from a DM");
  }

  const isCreator = conv.createdById?.toString() === requesterId;
  const isSelf = userId === requesterId;
  if (!isCreator && !isSelf) {
    throw new ForbiddenError(
      "Only the creator can remove others; members can only remove themselves",
    );
  }

  conv.participantIds = conv.participantIds.filter(
    (id) => id.toString() !== userId,
  );
  await conv.save();

  const participants = await buildParticipantsMap(conv.participantIds);
  return denormalizeConversation(conv, participants);
}

export interface ListMessagesInput {
  before?: Date;
  limit?: number;
}

export async function listMessages(
  conversationId: string,
  requesterId: string,
  input: ListMessagesInput,
): Promise<MessageResponseShape[]> {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError("conversationId must be a valid id");
  }
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new NotFoundError("Conversation");
  const isParticipant = convo.participantIds.some(
    (id) => id.toString() === requesterId,
  );
  if (!isParticipant) throw new ForbiddenError();

  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const filter: Record<string, unknown> = {
    conversationId: new Types.ObjectId(conversationId),
  };
  if (input.before) {
    filter.createdAt = { $lt: input.before };
  }
  const docs = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
  const authorIds = docs.map((d) => d.authorId);
  const authors = await buildAuthorNames(authorIds);
  return docs.map((d) => denormalizeMessage(d, authors));
}

export interface SendMessageInput {
  body?: string;
  attachment?: FileInput;
}

export async function sendMessage(
  conversationId: string,
  authorId: string,
  bodyOrInput: string | SendMessageInput,
): Promise<MessageResponseShape> {
  // Backward-compatible: accept a plain string (legacy callers) or the new
  // SendMessageInput object. New attachment support always uses the object form.
  const input: SendMessageInput =
    typeof bodyOrInput === "string" ? { body: bodyOrInput } : bodyOrInput;

  if (!Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError("conversationId must be a valid id");
  }

  const trimmed = (input.body ?? "").trim();
  const hasAttachment = !!input.attachment;
  if (!trimmed && !hasAttachment) {
    throw new ValidationError("Message must have body or attachment");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("body must be <= 4000 chars");
  }

  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new NotFoundError("Conversation");
  const isParticipant = convo.participantIds.some(
    (id) => id.toString() === authorId,
  );
  if (!isParticipant) throw new ForbiddenError();

  let saved: { url: string; key: string; contentType: string; size: number } | null =
    null;
  if (input.attachment) {
    saved = await storage.save("chat", authorId, input.attachment);
  }

  const created = await Message.create({
    conversationId: new Types.ObjectId(conversationId),
    authorId: new Types.ObjectId(authorId),
    body: trimmed,
    attachmentUrl: saved?.url ?? null,
    attachmentKey: saved?.key ?? null,
    attachmentName: input.attachment?.originalName ?? null,
    attachmentMimeType: input.attachment?.mimeType ?? null,
    attachmentSize: saved?.size ?? null,
  });

  convo.lastMessageAt = new Date();
  // Preview: text wins over attachment placeholder.
  const previewText =
    trimmed.length > 0
      ? trimmed.slice(0, 100)
      : input.attachment
        ? `[attachment] ${input.attachment.originalName}`.slice(0, 100)
        : "";
  convo.lastMessagePreview = previewText;
  await convo.save();

  const authors = await buildAuthorNames([created.authorId]);
  return denormalizeMessage(created, authors);
}
