import type { Namespace, Socket } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { Conversation } from "../models/conversation.model.js";
import { trackPresence } from "./presence.js";

interface ChatSocketData {
  userId: string;
  /** Unix-seconds expiry of the access token used at handshake. */
  tokenExp?: number;
}

function getUserId(socket: Socket): string {
  return (socket.data as ChatSocketData).userId;
}

function tokenIsExpired(socket: Socket): boolean {
  const exp = (socket.data as ChatSocketData).tokenExp;
  if (typeof exp !== "number") return false;
  return Math.floor(Date.now() / 1000) >= exp;
}

function disconnectIfExpired(socket: Socket): boolean {
  if (!tokenIsExpired(socket)) return false;
  logger.info(
    { namespace: "/chat", socketId: socket.id, userId: getUserId(socket) },
    "access token expired; disconnecting socket",
  );
  socket.disconnect(true);
  return true;
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
      const data = socket.data as ChatSocketData;
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
      { namespace: "/chat", socketId: socket.id, userId },
      "socket connected",
    );

    // Drop packets once the handshake's access token expires. See the matching
    // comment in calls.namespace.ts.
    socket.use((_packet, next) => {
      if (tokenIsExpired(socket)) {
        disconnectIfExpired(socket);
        return next(new Error("unauthorized"));
      }
      next();
    });

    // Wire the user into the presence registry — emits online/offline
    // events to the rest of the namespace on 0↔1 transitions and sends a
    // snapshot back to this socket so it can hydrate its local set.
    trackPresence(ns, socket, userId);

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
