import { io, type Socket } from "socket.io-client";
import type { ChatMessage } from "./api/hooks";

let socket: Socket | null = null;

function baseUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3000";
}

export function connectChatSocket(token: string): Socket {
  if (socket && socket.connected) {
    // Even when the underlying socket is already up, refresh the stored
    // auth so any subsequent transparent reconnect (e.g. after the network
    // blips) picks up the latest access token instead of an expired one.
    socket.auth = { token };
    return socket;
  }
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }
  socket = io(`${baseUrl()}/chat`, {
    transports: ["websocket"],
    autoConnect: true,
    auth: { token },
    withCredentials: true,
  });
  return socket;
}

export function disconnectChatSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinConversation(conversationId: string): void {
  socket?.emit("join", { conversationId });
}

export function leaveConversation(conversationId: string): void {
  socket?.emit("leave", { conversationId });
}

export function onMessage(cb: (msg: ChatMessage) => void): () => void {
  if (!socket) return () => undefined;
  const handler = (msg: ChatMessage) => cb(msg);
  socket.on("message", handler);
  return () => {
    socket?.off("message", handler);
  };
}

// --- Presence ---------------------------------------------------------------

export interface PresenceSnapshot {
  userIds: string[];
}

export interface PresenceTransition {
  userId: string;
}

/**
 * Subscribe to presence events on the chat namespace. Emits one initial
 * `snapshot` (the full set of online users on connect) and follow-up
 * `online` / `offline` deltas as users come and go. Returns an unsubscribe
 * cleanup function.
 */
export function onPresence(handlers: {
  snapshot?: (snap: PresenceSnapshot) => void;
  online?: (t: PresenceTransition) => void;
  offline?: (t: PresenceTransition) => void;
}): () => void {
  if (!socket) return () => undefined;
  const onSnap = (s: PresenceSnapshot) => handlers.snapshot?.(s);
  const onOn = (t: PresenceTransition) => handlers.online?.(t);
  const onOff = (t: PresenceTransition) => handlers.offline?.(t);
  socket.on("presence:snapshot", onSnap);
  socket.on("presence:online", onOn);
  socket.on("presence:offline", onOff);
  return () => {
    socket?.off("presence:snapshot", onSnap);
    socket?.off("presence:online", onOn);
    socket?.off("presence:offline", onOff);
  };
}

// --- Notifications ----------------------------------------------------------

/**
 * The chat namespace doubles as the realtime push channel for notifications:
 * the backend emits `notification:new` to `user:<id>` rooms whenever it
 * persists a notification. Subscribers should use the payload to invalidate
 * or update the notifications query cache directly.
 */
export interface PushedNotification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function onNotification(
  cb: (n: PushedNotification) => void,
): () => void {
  if (!socket) return () => undefined;
  const handler = (n: PushedNotification) => cb(n);
  socket.on("notification:new", handler);
  return () => {
    socket?.off("notification:new", handler);
  };
}
