import { Types } from "mongoose";
import {
  CallSession,
  type CallSessionDoc,
  type CallEndReason,
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
  caller: CallParticipantSummary;
  callee: CallParticipantSummary;
  status: CallStatus;
  startedAt: Date;
  acceptedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  endReason: CallEndReason | null;
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

export function denormalizeCall(
  s: CallSessionDoc,
  users: Map<string, CallParticipantSummary>,
): CallSessionResponseShape {
  const callerKey = s.callerId.toString();
  const calleeKey = s.calleeId.toString();
  const acceptedAt = s.acceptedAt ?? null;
  const endedAt = s.endedAt ?? null;
  let durationSeconds: number | null = null;
  if (acceptedAt && endedAt) {
    durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - acceptedAt.getTime()) / 1000),
    );
  }
  return {
    id: s._id.toString(),
    caller:
      users.get(callerKey) ?? {
        id: callerKey,
        name: "Unknown",
        avatarUrl: null,
      },
    callee:
      users.get(calleeKey) ?? {
        id: calleeKey,
        name: "Unknown",
        avatarUrl: null,
      },
    status: s.status as CallStatus,
    startedAt: s.startedAt,
    acceptedAt,
    endedAt,
    durationSeconds,
    endReason: (s.endReason ?? null) as CallEndReason | null,
  };
}

export async function initiateCall(
  callerId: string,
  calleeId: string,
): Promise<CallSessionResponseShape> {
  if (callerId === calleeId) {
    throw new ValidationError("Cannot call yourself");
  }
  if (!Types.ObjectId.isValid(calleeId)) {
    throw new ValidationError("calleeId must be a valid id");
  }
  const callee = await User.findById(calleeId).select("_id isActive").lean();
  if (!callee) throw new NotFoundError("User");
  if (callee.isActive === false) {
    throw new ValidationError("Callee is not active");
  }

  const created = await CallSession.create({
    callerId: new Types.ObjectId(callerId),
    calleeId: new Types.ObjectId(calleeId),
    status: "INVITED",
    startedAt: new Date(),
  });
  const users = await buildUserMap([created.callerId, created.calleeId]);
  return denormalizeCall(created, users);
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
  const isParticipant =
    doc.callerId.toString() === requesterId ||
    doc.calleeId.toString() === requesterId;
  if (!isParticipant) throw new ForbiddenError();
  const users = await buildUserMap([doc.callerId, doc.calleeId]);
  return denormalizeCall(doc, users);
}

export async function acceptCall(
  callId: string,
  calleeId: string,
): Promise<CallSessionResponseShape> {
  if (!Types.ObjectId.isValid(callId)) {
    throw new ValidationError("callId must be a valid id");
  }
  const doc = await CallSession.findById(callId);
  if (!doc) throw new NotFoundError("Call");
  if (doc.calleeId.toString() !== calleeId) {
    throw new ForbiddenError();
  }
  if (doc.status === "INVITED") {
    doc.status = "ACTIVE";
    doc.acceptedAt = new Date();
    await doc.save();
  }
  const users = await buildUserMap([doc.callerId, doc.calleeId]);
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
  const isParticipant =
    doc.callerId.toString() === requesterId ||
    doc.calleeId.toString() === requesterId;
  if (!isParticipant) throw new ForbiddenError();

  // Idempotent: if already ended, no-op.
  const alreadyEnded =
    doc.status === "ENDED" ||
    doc.status === "REJECTED" ||
    doc.status === "MISSED";
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
      } else {
        doc.status = "MISSED";
      }
    } else if (doc.status === "ACTIVE") {
      doc.status = "ENDED";
    }
    await doc.save();
  }
  const users = await buildUserMap([doc.callerId, doc.calleeId]);
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
  const docs = await CallSession.find({
    $or: [{ callerId: oid }, { calleeId: oid }],
  })
    .sort({ startedAt: -1 })
    .limit(limit);
  const allIds: Types.ObjectId[] = [];
  for (const d of docs) {
    allIds.push(d.callerId, d.calleeId);
  }
  const users = await buildUserMap(allIds);
  return docs.map((d) => denormalizeCall(d, users));
}
