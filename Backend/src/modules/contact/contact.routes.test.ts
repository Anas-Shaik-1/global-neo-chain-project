import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  startTestDb,
  stopTestDb,
  clearTestDb,
} from "../../test/setup.js";
import { setMailDriver, type MailDriver, type MailMessage } from "../../lib/mail.js";

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
    SEED_ADMIN_PASSWORD: "Strong-Pass-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    // Explicit so the test is decoupled from whatever MAIL_FROM the dev's
    // local .env currently has — the contact service reads
    // CONTACT_INBOX_TO from process.env each call.
    CONTACT_INBOX_TO: "inbox@test.local",
  });
});

let app: Express;

beforeAll(async () => {
  await startTestDb();
  const { createApp } = await import("../../app.js");
  app = createApp();
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("/contact", () => {
  it("POST /contact with a valid payload persists + queues a notification email", async () => {
    const sent: MailMessage[] = [];
    const fake: MailDriver = {
      async send(m) {
        sent.push(m);
      },
    };
    setMailDriver(fake);

    const res = await request(app).post("/contact").send({
      name: "Acme Inc",
      email: "buyer@acme.test",
      company: "Acme",
      message: "We need help building an inventory platform on AWS.",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[a-f0-9]{24}$/);
    expect(typeof res.body.receivedAt).toBe("string");

    expect(sent.length).toBe(1);
    expect(sent[0]!.to).toBe("inbox@test.local"); // CONTACT_INBOX_TO override
    expect(sent[0]!.replyTo).toBe("buyer@acme.test");
    expect(sent[0]!.subject).toContain("Acme Inc");
    expect(sent[0]!.text).toContain("inventory platform");

    const { ContactSubmission } = await import(
      "../../models/contactSubmission.model.js"
    );
    const stored = await ContactSubmission.findOne({ email: "buyer@acme.test" });
    expect(stored).not.toBeNull();
    expect(stored!.notifiedAt).toBeInstanceOf(Date);
  });

  it("POST /contact with the honeypot filled returns 201 but doesn't email or persist", async () => {
    const sent: MailMessage[] = [];
    setMailDriver({
      async send(m) {
        sent.push(m);
      },
    });

    const res = await request(app).post("/contact").send({
      name: "Bot",
      email: "bot@example.com",
      message: "spam spam spam spam spam spam",
      website: "http://attacker.example",
    });
    expect(res.status).toBe(201);
    expect(sent.length).toBe(0);

    const { ContactSubmission } = await import(
      "../../models/contactSubmission.model.js"
    );
    const stored = await ContactSubmission.findOne({});
    expect(stored).toBeNull();
  });

  it("POST /contact rejects a too-short message", async () => {
    const res = await request(app).post("/contact").send({
      name: "Acme",
      email: "buyer@acme.test",
      message: "short",
    });
    expect(res.status).toBe(400);
  });

  it("POST /contact rejects an invalid email", async () => {
    const res = await request(app).post("/contact").send({
      name: "Acme",
      email: "not-an-email",
      message: "This message is more than ten characters long.",
    });
    expect(res.status).toBe(400);
  });

  it("POST /contact still persists submission when notification email throws", async () => {
    setMailDriver({
      async send() {
        throw new Error("smtp boom");
      },
    });

    const res = await request(app).post("/contact").send({
      name: "Resilient",
      email: "ok@acme.test",
      message: "Mail driver fails but the form must still succeed.",
    });
    expect(res.status).toBe(201);

    const { ContactSubmission } = await import(
      "../../models/contactSubmission.model.js"
    );
    const stored = await ContactSubmission.findOne({ email: "ok@acme.test" });
    expect(stored).not.toBeNull();
    // Notification email failed, so notifiedAt stays null and a daemon
    // could later resend.
    expect(stored!.notifiedAt).toBeNull();
  });
});
