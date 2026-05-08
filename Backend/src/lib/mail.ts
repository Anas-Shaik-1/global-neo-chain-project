import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

export interface MailAttachment {
  filename: string;
  /** Either a buffer (e.g. a generated PDF) or a string of text. */
  content: Buffer | string;
  contentType?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Optional CC / BCC. Comma-separated list, or string[]. */
  cc?: string | string[];
  bcc?: string | string[];
  /** Where replies should go. Defaults to `MAIL_FROM`. */
  replyTo?: string;
  /** PDF, image, etc. attachments. */
  attachments?: MailAttachment[];
}

export interface MailDriver {
  send(message: MailMessage): Promise<void>;
}

// ─── Console driver ─────────────────────────────────────────────────────
/**
 * Default driver for development & MVP: pretty-prints the message to the
 * structured logger. NODE_ENV=production refuses to start with this driver
 * (config validation), so it's safe to keep as the dev default.
 */
class ConsoleMailDriver implements MailDriver {
  async send(m: MailMessage): Promise<void> {
    const attachmentNote = m.attachments?.length
      ? ` (+${m.attachments.length} attachment${m.attachments.length > 1 ? "s" : ""})`
      : "";
    logger.info(
      { to: m.to, subject: m.subject, attachments: m.attachments?.map((a) => a.filename) },
      `[console-mail] ${m.subject}${attachmentNote}\n--- ${m.to} ---\n${m.text}\n---`,
    );
  }
}

// ─── Header sanitization ────────────────────────────────────────────────
/**
 * Reject CR/LF in any user-controllable mail header field. SMTP headers are
 * line-delimited, so an unsanitized newline lets a caller inject extra
 * headers (Bcc:, Content-Type:, …) — classic email header injection.
 *
 * Throws a plain Error rather than a typed app error so this stays usable
 * from background jobs that don't have the request-context error mapper.
 */
function assertNoCrlf(name: string, value: string): void {
  if (typeof value !== "string") return;
  if (/[\r\n]/.test(value)) {
    throw new Error(`mail: ${name} contains CR/LF`);
  }
}

function assertHeaderField(
  name: string,
  value: string | string[] | undefined,
): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const v of value) assertNoCrlf(name, v);
  } else {
    assertNoCrlf(name, value);
  }
}

/** Strip C0 controls + DEL from a Subject. CR/LF is rejected separately. */
function sanitizeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  return subject.replace(/[\x00-\x1F\x7F]/g, "");
}

// ─── SMTP driver (nodemailer) ───────────────────────────────────────────
/**
 * SMTP driver backed by nodemailer. Reuses a single Transporter across
 * sends (TCP connections are pooled internally). On boot we don't `verify`
 * eagerly — the first send surfaces config errors. Verifying at startup
 * would couple boot to the SMTP server's availability, which is wrong for
 * a service whose primary loop is HTTP + Mongo.
 */
class SmtpMailDriver implements MailDriver {
  private transporter: Transporter;
  private from: string;

  constructor(opts: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    from: string;
  }) {
    this.from = opts.from;
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      // Encrypted on 465 (implicit TLS); STARTTLS on 587/25.
      secure: opts.port === 465,
      auth:
        opts.user && opts.pass
          ? { user: opts.user, pass: opts.pass }
          : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  async send(m: MailMessage): Promise<void> {
    // Reject CR/LF in any header-bearing field BEFORE handing the message
    // off to nodemailer — its own escaping is best-effort and covers some
    // fields but not all driver paths. Belt-and-braces here.
    assertHeaderField("from", this.from);
    assertHeaderField("to", m.to);
    assertHeaderField("cc", m.cc);
    assertHeaderField("bcc", m.bcc);
    assertHeaderField("replyTo", m.replyTo);
    assertHeaderField("subject", m.subject);
    // Subject also has no business carrying control characters; strip them
    // (CR/LF was already rejected above, so this just kills NUL/BEL/etc).
    const safeSubject = sanitizeSubject(m.subject);

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: m.to,
        cc: m.cc,
        bcc: m.bcc,
        subject: safeSubject,
        text: m.text,
        html: m.html,
        replyTo: m.replyTo,
        attachments: m.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      logger.info(
        {
          to: m.to,
          subject: m.subject,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        },
        "smtp-mail sent",
      );
    } catch (err) {
      logger.error(
        { err, to: m.to, subject: m.subject },
        "smtp-mail send failed",
      );
      throw err;
    }
  }
}

// ─── Driver selection (boot-time) ───────────────────────────────────────

let driver: MailDriver | null = null;

function buildDriverFromConfig(): MailDriver {
  // Tests must never accidentally hit a real SMTP relay — even if a dev's
  // .env has MAIL_DRIVER=smtp pointed at a production mailbox. Tests still
  // override with `setMailDriver` to assert behavior; this just ensures the
  // default before they do is harmless.
  if (process.env.NODE_ENV === "test") return new ConsoleMailDriver();

  switch (config.MAIL_DRIVER) {
    case "smtp": {
      if (!config.SMTP_HOST || !config.SMTP_PORT) {
        // Should be caught by loadConfig in production; fall back to console
        // here so dev environments don't crash on a partial SMTP config.
        logger.warn(
          { driver: "smtp" },
          "MAIL_DRIVER=smtp but SMTP_HOST/SMTP_PORT not set — falling back to console",
        );
        return new ConsoleMailDriver();
      }
      return new SmtpMailDriver({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
        from: config.MAIL_FROM,
      });
    }
    case "resend":
      // Resend driver lives behind the same MailDriver interface; not
      // implemented yet. Until it ships, fail loudly so an operator who
      // configures resend doesn't silently send to the console.
      throw new Error(
        "MAIL_DRIVER=resend is not yet implemented. Use smtp or console.",
      );
    case "console":
    default:
      return new ConsoleMailDriver();
  }
}

export function getMailDriver(): MailDriver {
  if (driver === null) driver = buildDriverFromConfig();
  return driver;
}

/**
 * Test hook (and prod boot hook): swap the driver implementation. Used by
 * unit tests to inject a recording driver, and could be used at boot to
 * substitute a non-config-driven driver.
 */
export function setMailDriver(d: MailDriver): void {
  driver = d;
}

/** Reset the cached driver — primarily for tests that mutate config. */
export function resetMailDriverCache(): void {
  driver = null;
}
