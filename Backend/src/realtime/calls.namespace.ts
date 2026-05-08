import type { Namespace, Socket } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { User } from "../models/user.model.js";
import { CallSession } from "../models/callSession.model.js";
import { acceptCall, endCall } from "../modules/calls/calls.service.js";

interface CallsSocketData {
  userId: string;
  /** Unix-seconds expiry of the access token used at handshake. */
  tokenExp?: number;
  // Per-socket cache of participantIds for a given callId. Avoids hitting Mongo
  // on every ICE candidate / peer-signal. Entries live as long as the socket;
  // CallSession.participantIds is immutable for the call's lifetime so cache
  // never goes stale. Capped (insertion-order LRU) so a long-lived socket
  // that participates in many calls doesn't grow unbounded.
  callParticipants?: Map<string, Set<string>>;
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const MAX_CACHED_CALLS_PER_SOCKET = 50;

// Per-socket token bucket for signaling fan-out events. Sized for typical
// WebRTC negotiation traffic (~tens of ICE candidates + offers/answers in a
// few seconds), with headroom. A misbehaving or compromised client gets its
// extra packets dropped server-side rather than amplified to peers.
const SIGNALING_RATE_TOKENS = 100; // bucket capacity = sustained rate / sec
const SIGNALING_RATE_REFILL_PER_MS = SIGNALING_RATE_TOKENS / 1000; // 100/sec
// Hard cap on the JSON-stringified size of a single signaling payload. ICE
// candidates and SDP blobs are tiny in practice; anything bigger is almost
// certainly malicious or buggy.
const SIGNALING_MAX_BYTES = 64 * 1024;

interface RateBucket {
  tokens: number;
  ts: number;
}
const rateBuckets = new Map<string, RateBucket>();

function consumeSignalingToken(socketId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(socketId);
  if (!bucket) {
    rateBuckets.set(socketId, { tokens: SIGNALING_RATE_TOKENS - 1, ts: now });
    return true;
  }
  const elapsed = now - bucket.ts;
  bucket.tokens = Math.min(
    SIGNALING_RATE_TOKENS,
    bucket.tokens + elapsed * SIGNALING_RATE_REFILL_PER_MS,
  );
  bucket.ts = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function payloadTooLarge(payload: unknown): boolean {
  try {
    return JSON.stringify(payload ?? null).length > SIGNALING_MAX_BYTES;
  } catch {
    // Circular refs etc. — refuse to forward something we can't serialize.
    return true;
  }
}

/**
 * Gate a signaling event by size + per-socket rate. Emits a structured
 * `call:error` to the originating socket on rejection so the FE can surface
 * a clear failure rather than silently dropping packets.
 */
function checkSignalingLimits(socket: Socket, payload: unknown): boolean {
  if (payloadTooLarge(payload)) {
    socket.emit("call:error", { code: "PAYLOAD_TOO_LARGE" });
    return false;
  }
  if (!consumeSignalingToken(socket.id)) {
    socket.emit("call:error", { code: "RATE_LIMITED" });
    return false;
  }
  return true;
}

function rememberParticipants(
  data: CallsSocketData,
  callId: string,
  participants: Set<string>,
): void {
  data.callParticipants ??= new Map();
  // Re-insert to bump LRU order.
  data.callParticipants.delete(callId);
  data.callParticipants.set(callId, participants);
  while (data.callParticipants.size > MAX_CACHED_CALLS_PER_SOCKET) {
    const oldest = data.callParticipants.keys().next().value;
    if (oldest === undefined) break;
    data.callParticipants.delete(oldest);
  }
}

function getUserId(socket: Socket): string {
  return (socket.data as CallsSocketData).userId;
}

function tokenIsExpired(socket: Socket): boolean {
  const exp = (socket.data as CallsSocketData).tokenExp;
  if (typeof exp !== "number") return false;
  return Math.floor(Date.now() / 1000) >= exp;
}

function disconnectIfExpired(socket: Socket): boolean {
  if (!tokenIsExpired(socket)) return false;
  logger.info(
    { namespace: "/calls", socketId: socket.id, userId: getUserId(socket) },
    "access token expired; disconnecting socket",
  );
  socket.disconnect(true);
  return true;
}

/**
 * Verifies the connected user is in the call's participantIds AND that the
 * call is still in a state where signaling makes sense (INVITED or ACTIVE).
 * Returns the participants set on success so callers can re-use it for peer
 * validation without a second lookup.
 *
 * Note: we re-fetch the call's `status` on every event rather than caching it.
 * `participantIds` is immutable for the call's lifetime so caching it is
 * safe, but `status` flips when any participant ends/rejects, and stale
 * authorization on an ENDED call would let signaling traffic continue to
 * fan out after hangup. One small Mongo round-trip per event is the right
 * tradeoff for correctness — calls aren't high-frequency at the per-call
 * level once ended.
 */
async function authorizeSender(
  socket: Socket,
  callId: string,
): Promise<Set<string> | null> {
  if (!OBJECT_ID_RE.test(callId)) return null;
  const userId = getUserId(socket);
  // Fetch participantIds (for cache-priming) and the live status in one go.
  const doc = await CallSession.findById(callId)
    .select("participantIds status")
    .lean();
  if (!doc) return null;
  if (doc.status !== "INVITED" && doc.status !== "ACTIVE") return null;
  const participants = new Set(doc.participantIds.map((id) => id.toString()));
  if (!participants.has(userId)) return null;
  rememberParticipants(socket.data as CallsSocketData, callId, participants);
  return participants;
}

export function attachCallsNamespace(ns: Namespace): void {
  ns.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      const data = socket.data as CallsSocketData;
      data.userId = payload.sub;
      data.tokenExp = payload.exp;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  ns.on("connection", (socket) => {
    const userId = getUserId(socket);
    logger.info(
      { namespace: "/calls", socketId: socket.id, userId },
      "socket connected",
    );

    // Drop packets if the access token from the handshake has expired. The
    // socket itself is force-disconnected so the client has to reconnect with
    // a fresh access token (the FE refresh interceptor mints one on the next
    // HTTP 401, then reconnects).
    socket.use((_packet, next) => {
      if (tokenIsExpired(socket)) {
        disconnectIfExpired(socket);
        return next(new Error("unauthorized"));
      }
      next();
    });

    // Each user joins a room named for their user id so we can emit directly
    // to all of their connected sockets (e.g. across multiple tabs).
    void socket.join(`user:${userId}`);

    // Clean up the per-socket rate-limit bucket so it doesn't leak memory.
    socket.on("disconnect", () => {
      rateBuckets.delete(socket.id);
    });

    // ─── Legacy 1-1 signaling (DIRECT calls keep using this) ───────────────
    socket.on(
      "call:invite",
      async (
        payload:
          | { callId?: string; calleeId?: string; offer?: unknown }
          | undefined,
      ) => {
        const callId = payload?.callId;
        const calleeId = payload?.calleeId;
        const offer = payload?.offer;
        if (
          typeof callId !== "string" ||
          typeof calleeId !== "string" ||
          offer === undefined
        ) {
          return;
        }
        try {
          // Only the call's initiator can broadcast invites, and only to a
          // user already enrolled as a participant of that call.
          const doc = await CallSession.findById(callId)
            .select("initiatorId participantIds")
            .lean();
          if (!doc) return;
          if (doc.initiatorId.toString() !== userId) return;
          const participantIds = doc.participantIds.map((id) => id.toString());
          if (!participantIds.includes(calleeId)) return;
          // Prime the per-socket cache so subsequent signaling is cheap.
          rememberParticipants(
            socket.data as CallsSocketData,
            callId,
            new Set(participantIds),
          );
          const caller = await User.findById(userId).select("name").lean();
          ns.to(`user:${calleeId}`).emit("call:incoming", {
            callId,
            callerId: userId,
            callerName: caller?.name ?? "Unknown",
            kind: "DIRECT",
            peerIds: [userId, calleeId],
            offer,
          });
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "failed to forward call:invite",
          );
        }
      },
    );

    socket.on(
      "call:accept",
      async (
        payload:
          | { callId?: string; callerId?: string; answer?: unknown }
          | undefined,
      ) => {
        const callId = payload?.callId;
        const callerId = payload?.callerId;
        const answer = payload?.answer;
        if (
          typeof callId !== "string" ||
          typeof callerId !== "string" ||
          answer === undefined
        ) {
          return;
        }
        const participants = await authorizeSender(socket, callId);
        if (!participants || !participants.has(callerId)) return;
        try {
          await acceptCall(callId, userId);
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "acceptCall persist failed",
          );
        }
        ns.to(`user:${callerId}`).emit("call:accepted", { callId, answer });
      },
    );

    socket.on(
      "call:reject",
      async (
        payload: { callId?: string; callerId?: string } | undefined,
      ) => {
        const callId = payload?.callId;
        const callerId = payload?.callerId;
        if (typeof callId !== "string" || typeof callerId !== "string") return;
        const participants = await authorizeSender(socket, callId);
        if (!participants || !participants.has(callerId)) return;
        try {
          await endCall(callId, userId, "REJECT");
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "endCall (reject) persist failed",
          );
        }
        ns.to(`user:${callerId}`).emit("call:rejected", { callId });
      },
    );

    socket.on(
      "call:ice-candidate",
      async (
        payload:
          | { callId?: string; peerUserId?: string; candidate?: unknown }
          | undefined,
      ) => {
        const callId = payload?.callId;
        const peerUserId = payload?.peerUserId;
        const candidate = payload?.candidate;
        if (
          typeof callId !== "string" ||
          typeof peerUserId !== "string" ||
          candidate === undefined ||
          peerUserId === userId
        ) {
          return;
        }
        if (!checkSignalingLimits(socket, payload)) return;
        const participants = await authorizeSender(socket, callId);
        if (!participants || !participants.has(peerUserId)) return;
        ns.to(`user:${peerUserId}`).emit("call:ice-candidate", {
          callId,
          candidate,
        });
      },
    );

    socket.on(
      "call:end",
      async (
        payload: { callId?: string; peerUserId?: string } | undefined,
      ) => {
        const callId = payload?.callId;
        const peerUserId = payload?.peerUserId;
        if (typeof callId !== "string") return;
        const participants = await authorizeSender(socket, callId);
        if (!participants) return;
        try {
          await endCall(callId, userId, "HANGUP");
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "endCall (hangup) persist failed",
          );
        }
        // Best-effort: notify the peer if we have one (1-1). For groups, the
        // multi-peer flow uses call:end-multi which broadcasts to all others.
        if (
          typeof peerUserId === "string" &&
          peerUserId.length > 0 &&
          participants.has(peerUserId)
        ) {
          ns.to(`user:${peerUserId}`).emit("call:ended", { callId });
        }
      },
    );

    // ─── Multi-peer mesh signaling (GROUP calls) ───────────────────────────
    // The initiator emits one call:invite-multi per peer with that peer's
    // offer signal. The server enriches with caller name and forwards to the
    // target user's room.
    socket.on(
      "call:invite-multi",
      async (
        payload:
          | {
              callId?: string;
              peerId?: string;
              peerIds?: string[];
              signal?: unknown;
              kind?: "DIRECT" | "GROUP";
            }
          | undefined,
      ) => {
        const callId = payload?.callId;
        const peerId = payload?.peerId;
        const signal = payload?.signal;
        const kind = payload?.kind ?? "GROUP";
        if (
          typeof callId !== "string" ||
          typeof peerId !== "string" ||
          signal === undefined
        ) {
          return;
        }
        try {
          // Only the call's initiator may invite peers, and only peers that
          // were enrolled in participantIds at call creation time.
          const doc = await CallSession.findById(callId)
            .select("initiatorId participantIds")
            .lean();
          if (!doc) return;
          if (doc.initiatorId.toString() !== userId) return;
          const enrolledIds = doc.participantIds.map((id) => id.toString());
          const enrolled = new Set(enrolledIds);
          if (!enrolled.has(peerId)) return;
          rememberParticipants(
            socket.data as CallsSocketData,
            callId,
            enrolled,
          );
          const caller = await User.findById(userId).select("name").lean();
          // Use the persisted participantIds for fan-out instead of trusting
          // whatever the client passed in `payload.peerIds` — otherwise a
          // malicious initiator could mislead the invitee about who is in
          // the call.
          ns.to(`user:${peerId}`).emit("call:incoming", {
            callId,
            callerId: userId,
            callerName: caller?.name ?? "Unknown",
            kind,
            peerIds: enrolledIds,
            offer: signal, // legacy field name preserved for compatibility
            signal,
          });
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "failed to forward call:invite-multi",
          );
        }
      },
    );

    // Unified peer-to-peer signal channel for offers, answers, and ICE
    // candidates. simple-peer's `signal` event emits whatever the peer
    // currently needs; the receiver's peer.signal() handles all kinds.
    socket.on(
      "call:peer-signal",
      async (
        payload:
          | { callId?: string; peerUserId?: string; signal?: unknown }
          | undefined,
      ) => {
        const callId = payload?.callId;
        const peerUserId = payload?.peerUserId;
        const signal = payload?.signal;
        if (
          typeof callId !== "string" ||
          typeof peerUserId !== "string" ||
          signal === undefined ||
          peerUserId === userId
        ) {
          return;
        }
        if (!checkSignalingLimits(socket, payload)) return;
        const participants = await authorizeSender(socket, callId);
        if (!participants || !participants.has(peerUserId)) return;
        ns.to(`user:${peerUserId}`).emit("call:peer-signal", {
          callId,
          fromUserId: userId,
          signal,
        });
      },
    );

    // When an invited peer accepts a group call, notify all other
    // participants so they can stand up new peer connections to the late
    // joiner if needed.
    socket.on(
      "call:accept-multi",
      async (
        payload: { callId?: string } | undefined,
      ) => {
        const callId = payload?.callId;
        if (typeof callId !== "string") return;
        const participants = await authorizeSender(socket, callId);
        if (!participants) return;
        try {
          await acceptCall(callId, userId);
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "acceptCall (multi) persist failed",
          );
        }
        // Broadcast acceptance to the other enrolled participants.
        for (const idStr of participants) {
          if (idStr === userId) continue;
          ns.to(`user:${idStr}`).emit("call:peer-accepted", {
            callId,
            userId,
          });
        }
      },
    );

    // Hangup for groups: tell all other participants this user has left.
    socket.on(
      "call:end-multi",
      async (payload: { callId?: string } | undefined) => {
        const callId = payload?.callId;
        if (typeof callId !== "string") return;
        const participants = await authorizeSender(socket, callId);
        if (!participants) return;
        try {
          // Only persist a final endCall when this is the last participant
          // hanging up — but for simplicity we let the existing endCall
          // idempotency cover that. The caller can decide.
          await endCall(callId, userId, "HANGUP");
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "endCall (multi-hangup) persist failed",
          );
        }
        for (const idStr of participants) {
          if (idStr === userId) continue;
          ns.to(`user:${idStr}`).emit("call:peer-left", {
            callId,
            userId,
          });
        }
      },
    );
  });
}
