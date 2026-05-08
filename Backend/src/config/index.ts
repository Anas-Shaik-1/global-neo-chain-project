import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().url().or(z.string().startsWith("mongodb")),
  FRONTEND_ORIGIN: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >=32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be >=32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(8),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  UPLOADS_DIR: z.string().default("uploads"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  // Storage driver. "local" writes under UPLOADS_DIR (good for dev).
  // "cloudinary" routes every save through the Cloudinary SDK and serves
  // assets via their CDN with on-the-fly transformations — production
  // default for any deployment that wants persistent media + responsive
  // images. The driver-specific secrets below are required when chosen.
  STORAGE_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // Mailer driver. "console" prints reset / verification links to logs (dev
  // only). "smtp" / "resend" require their respective config below; we
  // validate the driver-specific shape inside loadConfig().
  MAIL_DRIVER: z.enum(["console", "smtp", "resend"]).default("console"),
  MAIL_FROM: z.string().email().default("noreply@example.com"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  // Contact form
  // Where /contact submissions are emailed to. Defaults to MAIL_FROM if
  // unset, so a fresh deployment doesn't need to configure two mailboxes.
  CONTACT_INBOX_TO: z.string().email().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  const cfg = result.data;

  // Production-only checks. We don't run entropy / mail-driver gates in
  // dev/test because their fixtures (e.g. "x".repeat(32) JWT secrets,
  // MAIL_DRIVER=console) are deliberately convenient for local work.
  if (cfg.NODE_ENV === "production") {
    // Reject obviously low-entropy secrets that pass a 32-char length check.
    // "x".repeat(32) or sequential alphabets compile to <16 distinct chars
    // and are effectively guessable.
    const entropy = (s: string) => new Set(s).size;
    if (entropy(cfg.JWT_ACCESS_SECRET) < 16) {
      throw new Error(
        "Invalid environment: JWT_ACCESS_SECRET has too little entropy — use a random secret",
      );
    }
    if (entropy(cfg.JWT_REFRESH_SECRET) < 16) {
      throw new Error(
        "Invalid environment: JWT_REFRESH_SECRET has too little entropy — use a random secret",
      );
    }
    if (cfg.MAIL_DRIVER === "console") {
      throw new Error(
        "Invalid environment: MAIL_DRIVER=console is not allowed in production",
      );
    }
    if (cfg.MAIL_DRIVER === "smtp") {
      if (!cfg.SMTP_HOST || !cfg.SMTP_PORT) {
        throw new Error(
          "Invalid environment: MAIL_DRIVER=smtp requires SMTP_HOST and SMTP_PORT",
        );
      }
    }
    if (cfg.MAIL_DRIVER === "resend" && !cfg.RESEND_API_KEY) {
      throw new Error(
        "Invalid environment: MAIL_DRIVER=resend requires RESEND_API_KEY",
      );
    }
  }

  // Cloudinary driver requires the full credential triplet regardless of
  // NODE_ENV — without it the SDK can't authenticate and every upload will
  // fail at runtime. Caught at boot to fail fast.
  if (cfg.STORAGE_DRIVER === "cloudinary") {
    if (
      !cfg.CLOUDINARY_CLOUD_NAME ||
      !cfg.CLOUDINARY_API_KEY ||
      !cfg.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        "Invalid environment: STORAGE_DRIVER=cloudinary requires CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET",
      );
    }
  }

  return cfg;
}

export const config: Config = loadConfig();
