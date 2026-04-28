import { Server as IOServer, type Namespace } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { config } from "../config/index.js";
import { attachChatNamespace } from "./chat.namespace.js";
import { attachCallsNamespace } from "./calls.namespace.js";

let _chatNamespace: Namespace | null = null;
let _callsNamespace: Namespace | null = null;

export function setChatNamespace(ns: Namespace): void {
  _chatNamespace = ns;
}

export function getChatNamespace(): Namespace | null {
  return _chatNamespace;
}

export function setCallsNamespace(ns: Namespace): void {
  _callsNamespace = ns;
}

export function getCallsNamespace(): Namespace | null {
  return _callsNamespace;
}

export function attachSocketServer(http: HttpServer): IOServer {
  const io = new IOServer(http, {
    cors: { origin: config.FRONTEND_ORIGIN, credentials: true },
  });
  const chatNs = io.of("/chat");
  attachChatNamespace(chatNs);
  setChatNamespace(chatNs);
  const callsNs = io.of("/calls");
  attachCallsNamespace(callsNs);
  setCallsNamespace(callsNs);
  return io;
}
