import type { Namespace, Socket } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { Conversation } from "../models/conversation.model.js";

interface ChatSocketData {
  userId: string;
}

function getUserId(socket: Socket): string {
  return (socket.data as ChatSocketData).userId;
}

async function userIsParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) return false;
  const convo = await Conversation.findById(conversationId)
    .select("participantIds")
    .lean();
  if (!convo) return false;
  return convo.participantIds.some((id) => id.toString() === userId);
}

export function attachChatNamespace(ns: Namespace): void {
  ns.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as ChatSocketData).userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  ns.on("connection", (socket) => {
    const userId = getUserId(socket);
    logger.info(
      { namespace: "/chat", socketId: socket.id, userId },
      "socket connected",
    );

    socket.on("join", async (payload: { conversationId?: string } | undefined) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId !== "string") return;
      try {
        const allowed = await userIsParticipant(conversationId, userId);
        if (!allowed) return;
        await socket.join(`conversation:${conversationId}`);
      } catch (err) {
        logger.warn(
          { namespace: "/chat", err, conversationId },
          "failed to join conversation room",
        );
      }
    });

    socket.on("leave", async (payload: { conversationId?: string } | undefined) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId !== "string") return;
      try {
        await socket.leave(`conversation:${conversationId}`);
      } catch {
        // ignore
      }
    });
  });
}
