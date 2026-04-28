import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function baseUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3000";
}

export function getCallsSocket(): Socket | null {
  return socket;
}

export function connectCallsSocket(token: string): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }
  socket = io(`${baseUrl()}/calls`, {
    transports: ["websocket"],
    autoConnect: true,
    auth: { token },
    withCredentials: true,
  });
  return socket;
}

export function disconnectCallsSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export interface IncomingCallPayload {
  callId: string;
  callerId: string;
  callerName: string;
  offer: unknown;
}

export interface CallAcceptedPayload {
  callId: string;
  answer: unknown;
}

export interface CallRejectedPayload {
  callId: string;
}

export interface IceCandidatePayload {
  callId: string;
  candidate: unknown;
}

export interface CallEndedPayload {
  callId: string;
}

export function onIncomingCall(
  cb: (payload: IncomingCallPayload) => void,
): () => void {
  if (!socket) return () => undefined;
  const handler = (p: IncomingCallPayload) => cb(p);
  socket.on("call:incoming", handler);
  return () => {
    socket?.off("call:incoming", handler);
  };
}

export function onCallAccepted(
  cb: (payload: CallAcceptedPayload) => void,
): () => void {
  if (!socket) return () => undefined;
  const handler = (p: CallAcceptedPayload) => cb(p);
  socket.on("call:accepted", handler);
  return () => {
    socket?.off("call:accepted", handler);
  };
}

export function onCallRejected(
  cb: (payload: CallRejectedPayload) => void,
): () => void {
  if (!socket) return () => undefined;
  const handler = (p: CallRejectedPayload) => cb(p);
  socket.on("call:rejected", handler);
  return () => {
    socket?.off("call:rejected", handler);
  };
}

export function onIceCandidate(
  cb: (payload: IceCandidatePayload) => void,
): () => void {
  if (!socket) return () => undefined;
  const handler = (p: IceCandidatePayload) => cb(p);
  socket.on("call:ice-candidate", handler);
  return () => {
    socket?.off("call:ice-candidate", handler);
  };
}

export function onCallEnded(
  cb: (payload: CallEndedPayload) => void,
): () => void {
  if (!socket) return () => undefined;
  const handler = (p: CallEndedPayload) => cb(p);
  socket.on("call:ended", handler);
  return () => {
    socket?.off("call:ended", handler);
  };
}

export function emitInvite(payload: {
  callId: string;
  calleeId: string;
  offer: unknown;
}): void {
  socket?.emit("call:invite", payload);
}

export function emitAccept(payload: {
  callId: string;
  callerId: string;
  answer: unknown;
}): void {
  socket?.emit("call:accept", payload);
}

export function emitReject(payload: {
  callId: string;
  callerId: string;
}): void {
  socket?.emit("call:reject", payload);
}

export function emitIceCandidate(payload: {
  callId: string;
  peerUserId: string;
  candidate: unknown;
}): void {
  socket?.emit("call:ice-candidate", payload);
}

export function emitEnd(payload: { callId: string; peerUserId: string }): void {
  socket?.emit("call:end", payload);
}
