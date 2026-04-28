import type { Namespace, Socket } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { User } from "../models/user.model.js";
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
        if (typeof callId !== "string" || typeof peerUserId !== "string") {
          return;
        }
        try {
          await endCall(callId, userId, "HANGUP");
        } catch (err) {
          logger.warn(
            { namespace: "/calls", err, callId },
            "endCall (hangup) persist failed",
          );
        }
        ns.to(`user:${peerUserId}`).emit("call:ended", { callId });
      },
    );
  });
}
