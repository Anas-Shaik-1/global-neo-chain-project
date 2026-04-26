import { Server as IOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { config } from "../config/index.js";
import { attachChatNamespace } from "./chat.namespace.js";
import { attachCallsNamespace } from "./calls.namespace.js";

export function attachSocketServer(http: HttpServer): IOServer {
  const io = new IOServer(http, {
    cors: { origin: config.FRONTEND_ORIGIN, credentials: true },
  });
  attachChatNamespace(io.of("/chat"));
  attachCallsNamespace(io.of("/calls"));
  return io;
}
