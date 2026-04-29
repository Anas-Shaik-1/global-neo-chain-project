import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getMailDriver,
  setMailDriver,
  type MailDriver,
  type MailMessage,
} from "./mail.js";

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

describe("MailDriver", () => {
  // Capture the default driver so we can restore it after each test that
  // swaps it — keeps these unit tests from leaking into sibling tests that
  // exercise the requestPasswordReset flow.
  const original = getMailDriver();
  afterAll(() => setMailDriver(original));

  it("getMailDriver returns the console driver by default", () => {
    const d = getMailDriver();
    expect(typeof d.send).toBe("function");
  });

  it("setMailDriver swaps the implementation", async () => {
    const sent: MailMessage[] = [];
    const fake: MailDriver = {
      async send(m) {
        sent.push(m);
      },
    };
    setMailDriver(fake);
    await getMailDriver().send({ to: "a@b.com", subject: "Hi", text: "test" });
    expect(sent.length).toBe(1);
    expect(sent[0]!.to).toBe("a@b.com");
    expect(sent[0]!.subject).toBe("Hi");
  });
});
