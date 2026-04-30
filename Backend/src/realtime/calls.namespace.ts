import type { Namespace, Socket } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { User } from "../models/user.model.js";
import { CallSession } from "../models/callSession.model.js";
import { acceptCall, endCall } from "../modules/calls/calls.service.js";

interface CallsSocketData {
  userId: string;
}

function getUserId(socket: Socket): string {
  return (socket.data as CallsSocketData).userId;
}

export function attachCallsNamespace(ns: Namespace): void {
  ns.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as CallsSocketData).userId = payload.sub;
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

    // Each user joins a room named for their user id so we can emit directly
    // to all of their connected sockets (e.g. across multiple tabs).
    void socket.join(`user:${userId}`);

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
      (
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
          candidate === undefined
        ) {
          return;
        }
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
        if (typeof peerUserId === "string" && peerUserId.length > 0) {
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
        const peerIds = payload?.peerIds;
        const signal = payload?.signal;
        const kind = payload?.kind ?? "GROUP";
        if (
          typeof callId !== "string" ||
          typeof peerId !== "string" ||
          !Array.isArray(peerIds) ||
          signal === undefined
        ) {
          return;
        }
        try {
          const caller = await User.findById(userId).select("name").lean();
          ns.to(`user:${peerId}`).emit("call:incoming", {
            callId,
            callerId: userId,
            callerName: caller?.name ?? "Unknown",
            kind,
            peerIds,
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
      (
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
          signal === undefined
        ) {
          return;
        }
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
        try {
          await acceptCall(callId, userId);
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "acceptCall (multi) persist failed",
          );
        }
        // Look up the call's participants and broadcast acceptance to all
        // others in the call so they can converge mesh connections.
        try {
          const doc = await CallSession.findById(callId).select("participantIds").lean();
          if (!doc) return;
          for (const id of doc.participantIds) {
            const idStr = id.toString();
            if (idStr === userId) continue;
            ns.to(`user:${idStr}`).emit("call:peer-accepted", {
              callId,
              userId,
            });
          }
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "failed to broadcast call:peer-accepted",
          );
        }
      },
    );

    // Hangup for groups: tell all other participants this user has left.
    socket.on(
      "call:end-multi",
      async (payload: { callId?: string } | undefined) => {
        const callId = payload?.callId;
        if (typeof callId !== "string") return;
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
        try {
          const doc = await CallSession.findById(callId).select("participantIds").lean();
          if (!doc) return;
          for (const id of doc.participantIds) {
            const idStr = id.toString();
            if (idStr === userId) continue;
            ns.to(`user:${idStr}`).emit("call:peer-left", {
              callId,
              userId,
            });
          }
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "failed to broadcast call:peer-left",
          );
        }
      },
    );
  });
}
