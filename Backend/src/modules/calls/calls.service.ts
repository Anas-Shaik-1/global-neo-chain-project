import { Types } from "mongoose";
import {
  CallSession,
  type CallSessionDoc,
  type CallEndReason,
  type CallKind,
  type CallStatus,
} from "../../models/callSession.model.js";
import { User } from "../../models/user.model.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";

export interface CallParticipantSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CallSessionResponseShape {
  id: string;
  /** All participants of the call (initiator included). */
  participants: CallParticipantSummary[];
  /** The user who initiated the call. */
  initiatorId: string;
  initiatorName: string;
  kind: CallKind;
  status: CallStatus;
  startedAt: Date;
  acceptedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  endReason: CallEndReason | null;
  /**
   * Convenience for legacy 1-1 UIs: only present for DIRECT calls.
   * Always equals the initiator.
   */
  caller?: CallParticipantSummary;
  /**
   * Convenience for legacy 1-1 UIs: only present for DIRECT calls.
   * The non-initiator participant.
   */
  callee?: CallParticipantSummary;
}

async function buildUserMap(
  ids: Types.ObjectId[],
): Promise<Map<string, CallParticipantSummary>> {
  const unique = Array.from(new Set(ids.map((i) => i.toString())));
  const map = new Map<string, CallParticipantSummary>();
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
  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, { id, name: "Unknown", avatarUrl: null });
    }
  }
  return map;
}

function unknown(id: string): CallParticipantSummary {
  return { id, name: "Unknown", avatarUrl: null };
}

export function denormalizeCall(
  s: CallSessionDoc,
  users: Map<string, CallParticipantSummary>,
): CallSessionResponseShape {
  const initiatorKey = s.initiatorId.toString();
  const initiator = users.get(initiatorKey) ?? unknown(initiatorKey);
  const participants = s.participantIds.map((id) => {
    const k = id.toString();
    return users.get(k) ?? unknown(k);
  });
  const acceptedAt = s.acceptedAt ?? null;
  const endedAt = s.endedAt ?? null;
  let durationSeconds: number | null = null;
  if (acceptedAt && endedAt) {
    durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - acceptedAt.getTime()) / 1000),
    );
  }
  const kind = (s.kind ?? "DIRECT") as CallKind;
  const out: CallSessionResponseShape = {
    id: s._id.toString(),
    participants,
    initiatorId: initiatorKey,
    initiatorName: initiator.name,
    kind,
    status: s.status as CallStatus,
    startedAt: s.startedAt,
    acceptedAt,
    endedAt,
    durationSeconds,
    endReason: (s.endReason ?? null) as CallEndReason | null,
  };
  if (kind === "DIRECT") {
    // Provide caller/callee convenience fields for the legacy 1-1 UI.
    const other =
      participants.find((p) => p.id !== initiatorKey) ?? participants[1] ?? initiator;
    out.caller = initiator;
    out.callee = other;
  }
  return out;
}

export async function initiateCall(
  initiatorId: string,
  peerIds: string[],
): Promise<CallSessionResponseShape> {
  if (!Array.isArray(peerIds) || peerIds.length === 0) {
    throw new ValidationError("At least one peer required");
  }
  if (peerIds.length > 3) {
    throw new ValidationError("Group calls support up to 4 participants");
  }
  if (peerIds.some((id) => id === initiatorId)) {
    throw new ValidationError("Cannot include yourself as peer");
  }
  // De-dup: forbid duplicate peer ids in input.
  const unique = new Set(peerIds);
  if (unique.size !== peerIds.length) {
    throw new ValidationError("Duplicate peer ids");
  }
  for (const id of peerIds) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError("peerIds must contain valid ids");
    }
  }
  if (!Types.ObjectId.isValid(initiatorId)) {
    throw new ValidationError("initiatorId must be a valid id");
  }

  const allIds = [initiatorId, ...peerIds];
  const users = await User.find({
    _id: { $in: allIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id isActive")
    .lean();
  if (users.length !== allIds.length) {
    throw new ValidationError("One or more peers don't exist");
  }
  for (const u of users) {
    if (u.isActive === false) {
      throw new ValidationError("One or more peers are inactive");
    }
  }

  const created = await CallSession.create({
    participantIds: allIds.map((id) => new Types.ObjectId(id)),
    initiatorId: new Types.ObjectId(initiatorId),
    kind: peerIds.length === 1 ? "DIRECT" : "GROUP",
    status: "INVITED",
    startedAt: new Date(),
  });
  const userMap = await buildUserMap(created.participantIds);
  return denormalizeCall(created, userMap);
}

export async function getCall(
  callId: string,
  requesterId: string,
): Promise<CallSessionResponseShape> {
  if (!Types.ObjectId.isValid(callId)) {
    throw new ValidationError("callId must be a valid id");
  }
  const doc = await CallSession.findById(callId);
  if (!doc) throw new NotFoundError("Call");
  const isParticipant = doc.participantIds.some(
    (id) => id.toString() === requesterId,
  );
  if (!isParticipant) throw new ForbiddenError();
  const users = await buildUserMap(doc.participantIds);
  return denormalizeCall(doc, users);
}

export async function acceptCall(
  callId: string,
  userId: string,
): Promise<CallSessionResponseShape> {
  if (!Types.ObjectId.isValid(callId)) {
    throw new ValidationError("callId must be a valid id");
  }
  const doc = await CallSession.findById(callId);
  if (!doc) throw new NotFoundError("Call");
  // The initiator can't "accept" their own call; only invited peers can.
  if (doc.initiatorId.toString() === userId) {
    throw new ForbiddenError();
  }
  const isParticipant = doc.participantIds.some(
    (id) => id.toString() === userId,
  );
  if (!isParticipant) throw new ForbiddenError();
  if (doc.status === "INVITED") {
    doc.status = "ACTIVE";
    doc.acceptedAt = new Date();
    await doc.save();
  }
  const users = await buildUserMap(doc.participantIds);
  return denormalizeCall(doc, users);
}

export async function endCall(
  callId: string,
  requesterId: string,
  reason: CallEndReason,
): Promise<CallSessionResponseShape> {
  if (!Types.ObjectId.isValid(callId)) {
    throw new ValidationError("callId must be a valid id");
  }
  const doc = await CallSession.findById(callId);
  if (!doc) throw new NotFoundError("Call");
  const isParticipant = doc.participantIds.some(
    (id) => id.toString() === requesterId,
  );
  if (!isParticipant) throw new ForbiddenError();

  // Idempotent: if already ended, no-op.
  const alreadyEnded =
    doc.status === "ENDED" ||
    doc.status === "REJECTED" ||
    doc.status === "MISSED";
  let transitionedToMissed = false;
  if (!alreadyEnded) {
    doc.endedAt = new Date();
    doc.endReason = reason;
    if (doc.status === "INVITED") {
      // Pre-accept: REJECT or TIMEOUT mark transitions; HANGUP from caller
      // before answer is treated as MISSED for the callee.
      if (reason === "REJECT") {
        doc.status = "REJECTED";
      } else if (reason === "TIMEOUT") {
        doc.status = "MISSED";
        transitionedToMissed = true;
      } else {
        doc.status = "MISSED";
        transitionedToMissed = true;
      }
    } else if (doc.status === "ACTIVE") {
      doc.status = "ENDED";
    }
    await doc.save();
  }
  const users = await buildUserMap(doc.participantIds);

  // Notify the non-initiators who never picked up. Only fire on the
  // INVITED → MISSED transition; REJECTED is the callee's own action and
  // ENDED happened after both parties were on the call.
  if (transitionedToMissed) {
    const initiatorId = doc.initiatorId.toString();
    const callerName = users.get(initiatorId)?.name ?? "Someone";
    const recipients = doc.participantIds
      .map((id) => id.toString())
      .filter((id) => id !== initiatorId);
    void (async () => {
      const { notifyMany } = await import(
        "../notifications/notifications.service.js"
      );
      await notifyMany(recipients, {
        kind: "CALL_MISSED",
        title: `Missed call from ${callerName}`,
        link: "/calls",
      });
    })().catch(() => {
      // Best-effort: dynamic import path. Failures are visible in the realtime
      // logs already; we don't want a notify failure to break the call flow.
    });
  }

  return denormalizeCall(doc, users);
}

export interface ListMyCallsInput {
  limit?: number;
}

export async function listMyCalls(
  userId: string,
  input: ListMyCallsInput,
): Promise<CallSessionResponseShape[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const oid = new Types.ObjectId(userId);
  const docs = await CallSession.find({ participantIds: oid })
    .sort({ startedAt: -1 })
    .limit(limit);
  const allIds: Types.ObjectId[] = [];
  for (const d of docs) {
    for (const id of d.participantIds) allIds.push(id);
  }
  const users = await buildUserMap(allIds);
  return docs.map((d) => denormalizeCall(d, users));
}
