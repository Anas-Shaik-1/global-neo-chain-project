import { logger } from "./logger.js";

export interface SmsMessage {
  /** E.164 phone number — caller is responsible for normalising. */
  to: string;
  body: string;
}

export interface SmsDriver {
  send(message: SmsMessage): Promise<void>;
}

/**
 * Default driver for development & MVP: prints the message to the structured
 * logger so devs can grab the OTP locally. Production deployments should swap
 * this out via {@link setSmsDriver} at boot for a real provider (Twilio,
 * MessageBird, Vonage, etc.) — all behind this same interface.
 */
class ConsoleSmsDriver implements SmsDriver {
  async send(m: SmsMessage): Promise<void> {
    logger.info(
      { to: m.to },
      `[console SMS] to=${m.to}: ${m.body}`,
    );
  }
}

let driver: SmsDriver | null = null;

export function getSmsDriver(): SmsDriver {
  if (driver === null) driver = new ConsoleSmsDriver();
  return driver;
}

// Test hook (and prod boot hook): swap the driver implementation.
export function setSmsDriver(d: SmsDriver): void {
  driver = d;
}
