import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { io as ioClient } from "socket.io-client";
import type { AddressInfo } from "node:net";

beforeAll(() => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
});

let http: HttpServer;
let port: number;

beforeAll(async () => {
  const { attachSocketServer } = await import("./index.js");
  http = createServer();
  attachSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  port = (http.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => http.close(() => resolve()));
});

describe("socket.io namespaces", () => {
  it("rejects /chat connection without token", async () => {
    const socket = ioClient(`http://localhost:${port}/chat`, { reconnection: false, transports: ["websocket"] });
    const err = await new Promise<Error>((resolve) => socket.on("connect_error", resolve));
    expect(err.message).toBe("unauthorized");
    socket.close();
  });

  it("accepts /chat connection with valid token", async () => {
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "ADMIN" });
    const socket = ioClient(`http://localhost:${port}/chat`, {
      reconnection: false,
      transports: ["websocket"],
      auth: { token },
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", (err) => reject(err));
    });
    expect(socket.connected).toBe(true);
    socket.close();
  });
});
