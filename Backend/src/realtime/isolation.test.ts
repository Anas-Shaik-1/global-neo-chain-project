import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { Types } from "mongoose";
import { startTestDb, stopTestDb } from "../test/setup.js";

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
  await startTestDb();
  const { User } = await import("../models/user.model.js");
  const { CallSession } = await import("../models/callSession.model.js");
  const { Conversation } = await import("../models/conversation.model.js");
  await User.init();
  await CallSession.init();
  await Conversation.init();

  const { attachSocketServer } = await import("./index.js");
  http = createServer();
  attachSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  port = (http.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => http.close(() => resolve()));
  await stopTestDb();
});

function tokenFor(userId: string): Promise<string> {
  return import("../lib/tokens.js").then(({ signAccessToken }) =>
    signAccessToken({ sub: userId, role: "EMPLOYEE", isProjectManager: false }),
  );
}

function connect(namespace: "/calls" | "/chat", token: string): Promise<ClientSocket> {
  const sock = ioClient(`http://localhost:${port}${namespace}`, {
    reconnection: false,
    transports: ["websocket"],
    auth: { token },
  });
  return new Promise<ClientSocket>((resolve, reject) => {
    sock.once("connect", () => resolve(sock));
    sock.once("connect_error", reject);
  });
}

function neverReceives(sock: ClientSocket, event: string, ms = 250): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (...args: unknown[]) =>
      reject(new Error(`unexpected ${event}: ${JSON.stringify(args)}`));
    sock.on(event, handler);
    setTimeout(() => {
      sock.off(event, handler);
      resolve();
    }, ms);
  });
}

function eventuallyReceives<T = unknown>(
  sock: ClientSocket,
  event: string,
  ms = 1000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    sock.once(event, (payload: T) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

describe("calls namespace authorization", () => {
  it("non-participant cannot inject call:peer-signal", async () => {
    const { CallSession } = await import("../models/callSession.model.js");
    const aliceId = new Types.ObjectId().toString();
    const bobId = new Types.ObjectId().toString();
    const malloryId = new Types.ObjectId().toString();
    const call = await CallSession.create({
      participantIds: [new Types.ObjectId(aliceId), new Types.ObjectId(bobId)],
      initiatorId: new Types.ObjectId(aliceId),
      kind: "DIRECT",
      status: "ACTIVE",
      startedAt: new Date(),
      acceptedAt: new Date(),
    });

    const aliceSock = await connect("/calls", await tokenFor(aliceId));
    const bobSock = await connect("/calls", await tokenFor(bobId));
    const mallorySock = await connect("/calls", await tokenFor(malloryId));

    try {
      const noSignal = neverReceives(bobSock, "call:peer-signal");
      mallorySock.emit("call:peer-signal", {
        callId: call._id.toString(),
        peerUserId: bobId,
        signal: { type: "fake-offer", sdp: "x" },
      });
      await noSignal;

      // Sanity: a real participant CAN signal a peer.
      const realSignal = eventuallyReceives<{ fromUserId: string }>(
        bobSock,
        "call:peer-signal",
      );
      aliceSock.emit("call:peer-signal", {
        callId: call._id.toString(),
        peerUserId: bobId,
        signal: { type: "offer", sdp: "y" },
      });
      const got = await realSignal;
      expect(got.fromUserId).toBe(aliceId);
    } finally {
      aliceSock.close();
      bobSock.close();
      mallorySock.close();
    }
  });

  it("participant cannot signal a non-participant peer", async () => {
    const { CallSession } = await import("../models/callSession.model.js");
    const aliceId = new Types.ObjectId().toString();
    const bobId = new Types.ObjectId().toString();
    const carolId = new Types.ObjectId().toString();
    const call = await CallSession.create({
      participantIds: [new Types.ObjectId(aliceId), new Types.ObjectId(bobId)],
      initiatorId: new Types.ObjectId(aliceId),
      kind: "DIRECT",
      status: "ACTIVE",
      startedAt: new Date(),
    });

    const aliceSock = await connect("/calls", await tokenFor(aliceId));
    const carolSock = await connect("/calls", await tokenFor(carolId));

    try {
      const noSignal = neverReceives(carolSock, "call:peer-signal");
      aliceSock.emit("call:peer-signal", {
        callId: call._id.toString(),
        peerUserId: carolId,
        signal: { sdp: "x" },
      });
      await noSignal;
    } finally {
      aliceSock.close();
      carolSock.close();
    }
  });

  it("non-initiator cannot send call:invite-multi for a call they do not own", async () => {
    const { CallSession } = await import("../models/callSession.model.js");
    const aliceId = new Types.ObjectId().toString();
    const bobId = new Types.ObjectId().toString();
    const malloryId = new Types.ObjectId().toString();
    const call = await CallSession.create({
      participantIds: [new Types.ObjectId(aliceId), new Types.ObjectId(bobId)],
      initiatorId: new Types.ObjectId(aliceId),
      kind: "GROUP",
      status: "INVITED",
      startedAt: new Date(),
    });

    const bobSock = await connect("/calls", await tokenFor(bobId));
    const mallorySock = await connect("/calls", await tokenFor(malloryId));

    try {
      const noIncoming = neverReceives(bobSock, "call:incoming");
      mallorySock.emit("call:invite-multi", {
        callId: call._id.toString(),
        peerId: bobId,
        peerIds: [malloryId, bobId],
        signal: { sdp: "x" },
        kind: "GROUP",
      });
      await noIncoming;
    } finally {
      bobSock.close();
      mallorySock.close();
    }
  });
});

describe("chat namespace isolation", () => {
  it("non-participant cannot join a conversation room", async () => {
    const { Conversation } = await import("../models/conversation.model.js");
    const aliceId = new Types.ObjectId().toString();
    const bobId = new Types.ObjectId().toString();
    const malloryId = new Types.ObjectId().toString();
    const convo = await Conversation.create({
      kind: "DM",
      participantIds: [new Types.ObjectId(aliceId), new Types.ObjectId(bobId)],
      createdById: new Types.ObjectId(aliceId),
      pairKey: [aliceId, bobId].sort().join(":"),
    });

    const mallorySock = await connect("/chat", await tokenFor(malloryId));
    try {
      mallorySock.emit("join", { conversationId: convo._id.toString() });
      // Allow the server to reject; the join is silent (no ack), so verify
      // by checking that mallory's socket is not in the conversation room.
      await new Promise((r) => setTimeout(r, 100));
      const { getChatNamespace } = await import("./index.js");
      const ns = getChatNamespace();
      const roomSockets = await ns!
        .in(`conversation:${convo._id.toString()}`)
        .fetchSockets();
      expect(roomSockets.length).toBe(0);
    } finally {
      mallorySock.close();
    }
  });
});
