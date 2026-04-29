import { logger } from "./logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailDriver {
  send(message: MailMessage): Promise<void>;
}

/**
 * Default driver for development & MVP: pretty-prints the message to the
 * structured logger. Production deployments should swap this out via
 * `setMailDriver` at boot for a real provider (SES, Postmark, Resend, etc.).
 */
class ConsoleMailDriver implements MailDriver {
  async send(m: MailMessage): Promise<void> {
    logger.info(
      { to: m.to, subject: m.subject },
      `[console-mail] ${m.subject}\n--- ${m.to} ---\n${m.text}\n---`,
    );
  }
}

// Future: SendGridMailDriver, SmtpMailDriver, etc. — all behind this interface.

let driver: MailDriver | null = null;

export function getMailDriver(): MailDriver {
  if (driver === null) driver = new ConsoleMailDriver();
  return driver;
}

// Test hook (and prod boot hook): swap the driver implementation.
export function setMailDriver(d: MailDriver): void {
  driver = d;
}
