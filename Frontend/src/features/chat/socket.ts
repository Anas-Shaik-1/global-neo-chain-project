import { io, type Socket } from "socket.io-client";
import type { ChatMessage } from "./api/hooks";

let socket: Socket | null = null;

function baseUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3000";
}

export function connectChatSocket(token: string): Socket {
  if (socket && socket.connected) return socket;
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
