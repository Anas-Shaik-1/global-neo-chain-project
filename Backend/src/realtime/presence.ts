import type { Namespace, Socket } from "socket.io";
import { Types } from "mongoose";
import { logger } from "../lib/logger.js";
import { Conversation } from "../models/conversation.model.js";

/**
 * Lightweight in-memory presence registry.
 *
 * Tracks how many active sockets a userId has (a user can be online from
 * multiple tabs/devices). Transitions across the 0↔1 boundary fire
 * `presence:online` / `presence:offline` events on the chat namespace so
 * clients can update their UI in real time without polling.
 *
 * Multi-instance deployments would back this with Redis (pub/sub + a TTL
 * key per socket); single-instance is what we ship today.
 */
const socketCounts = new Map<string, number>();

export function getOnlineUserIds(): string[] {
  return Array.from(socketCounts.keys());
}

export function isUserOnline(userId: string): boolean {
  return (socketCounts.get(userId) ?? 0) > 0;
}

/**
 * Resolve the set of userIds that share at least one conversation with the
 * given user. Used to scope presence visibility so a user only learns about
 * the online state of people they actually chat with — rather than every
 * online user in the org.
 */
async function getConversationPeerIds(userId: string): Promise<Set<string>> {
  if (!Types.ObjectId.isValid(userId)) return new Set();
  const meOid = new Types.ObjectId(userId);
  const ids = (await Conversation.distinct("participantIds", {
    participantIds: meOid,
  })) as Types.ObjectId[];
  const out = new Set<string>();
  for (const id of ids) {
    const s = id.toString();
    if (s !== userId) out.add(s);
  }
  return out;
}

/**
 * Wire a chat-namespace `Socket` into the presence registry. Increments the
 * user's connection count on connect and decrements on disconnect, emitting
 * a presence event to the rest of the namespace on each 0↔1 transition.
 */
export function trackPresence(ns: Namespace, socket: Socket, userId: string) {
  const current = socketCounts.get(userId) ?? 0;
  socketCounts.set(userId, current + 1);
  if (current === 0) {
    // 0 → 1: user just came online.
    // TODO(presence-fanout): this broadcasts to every connected socket in the
    // namespace, which still leaks the fact that `userId` is online to people
    // who don't share a conversation with them. The clean fix is to have
    // every socket join `presence:peer:<peerId>` rooms on connect (one room
    // per conversation peer) and emit only to those rooms here. That's
    // invasive — for now we only fix the snapshot leak below; this broadcast
    // remains org-wide.
    ns.emit("presence:online", { userId });
    logger.info({ userId }, "presence: user online");
  }

  socket.on("disconnect", () => {
    const after = (socketCounts.get(userId) ?? 1) - 1;
    if (after <= 0) {
      socketCounts.delete(userId);
      // TODO(presence-fanout): same scope problem as the `online` broadcast
      // above; scoping requires per-peer rooms.
      ns.emit("presence:offline", { userId });
      logger.info({ userId }, "presence: user offline");
    } else {
      socketCounts.set(userId, after);
    }
  });

  // On the new socket itself, emit the full snapshot so the client can
  // hydrate its local set on connect without a separate REST call. Filter
  // to userIds the requester actually shares a conversation with — sending
  // the full list leaks every online user in the org to every connecting
  // socket. Best-effort: on DB error we fall back to an empty list rather
  // than the leaky full list.
  void (async () => {
    try {
      const peers = await getConversationPeerIds(userId);
      const online = socketCounts;
      const visible: string[] = [];
      for (const peer of peers) {
        if ((online.get(peer) ?? 0) > 0) visible.push(peer);
      }
      socket.emit("presence:snapshot", { userIds: visible });
    } catch (err) {
      logger.warn({ err, userId }, "presence: snapshot scope lookup failed");
      socket.emit("presence:snapshot", { userIds: [] });
    }
  })();
}
