import type { Namespace } from "socket.io";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/tokens.js";

export function attachCallsNamespace(ns: Namespace): void {
  ns.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as { userId: string }).userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  ns.on("connection", (socket) => {
    const userId = (socket.data as { userId: string }).userId;
    logger.info({ namespace: "/calls", socketId: socket.id, userId }, "socket connected");
  });
}
