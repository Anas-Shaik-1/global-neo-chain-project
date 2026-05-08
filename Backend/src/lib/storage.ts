import { mkdir, writeFile, unlink, lstat } from "node:fs/promises";
import path, { dirname, join, resolve } from "node:path";
import { v4 as uuid } from "uuid";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { config } from "../config/index.js";

export type StorageScope =
  | "avatar"
  | "resume"
  | "receipt"
  | "payslip"
  | "chat"
  | "bug";

/**
 * Responsive image variants returned for any avatar upload. Driven by
 * Cloudinary on-the-fly transformations on the cloud driver, and fall back
 * to the original URL on the local driver (small/medium/large all point to
 * the same file there).
 */
export interface AvatarVariants {
  /** 64×64 thumb — sidebar, mention chips. */
  small: string;
  /** 128×128 — profile cards, message bubbles. */
  medium: string;
  /** 512×512 — profile pages, large detail views. */
  large: string;
}

export interface SavedFile {
  key: string;
  url: string;
  contentType: string;
  size: number;
  /** Set only when scope=avatar. Caller can pick the size that fits the surface. */
  variants?: AvatarVariants;
}

export interface FileInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface FileStorage {
  save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile>;
  delete(key: string): Promise<void>;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
};

const ALLOWED_BY_SCOPE: Record<StorageScope, string[]> = {
  avatar: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
  resume: ["application/pdf"],
  receipt: ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"],
  payslip: ["application/pdf"],
  chat: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    // Voice messages.
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/mpeg",
    "audio/ogg",
  ],
  // Bug screenshot uploads — images only.
  bug: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
};

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function validateScopeMime(scope: StorageScope, mime: string): string {
  if (!ALLOWED_BY_SCOPE[scope].includes(mime)) {
    throw new Error(`unsupported mimeType ${mime} for scope ${scope}`);
  }
  const ext = MIME_EXTENSIONS[mime];
  if (!ext) throw new Error(`unsupported mimeType ${mime}`);
  return ext;
}

class LocalStorage implements FileStorage {
  constructor(private rootDir: string, private publicBaseUrl: string) {}

  async save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile> {
    const ext = validateScopeMime(scope, file.mimeType);
    const key = `${scope}/${userId}-${uuid()}.${ext}`;
    const fullPath = join(this.rootDir, key);
    // Defense-in-depth — `key` is server-generated from a UUID + a fixed
    // scope, but a future caller might pass attacker-influenced data.
    // Refuse anything that escapes the uploads root, mirroring `delete`.
    const rootResolved = resolve(this.rootDir);
    const resolvedDest = resolve(fullPath);
    if (
      resolvedDest !== rootResolved &&
      !resolvedDest.startsWith(rootResolved + path.sep)
    ) {
      throw new Error("invalid storage destination");
    }
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer);
    const url = `${this.publicBaseUrl}/files/${key}`;
    const out: SavedFile = {
      key,
      url,
      contentType: file.mimeType,
      size: file.buffer.length,
    };
    // Local driver doesn't transform images; expose the same URL under all
    // variant labels so callers can pick "size: small" without branching on
    // the driver in use.
    if (scope === "avatar") {
      out.variants = { small: url, medium: url, large: url };
    }
    return out;
  }

  async delete(key: string): Promise<void> {
    // All current callers pass server-generated keys read from the DB, but
    // defense-in-depth: refuse anything that could escape the uploads root.
    if (typeof key !== "string" || key.length === 0 || key.includes("\0")) {
      throw new Error("invalid storage key");
    }
    if (path.isAbsolute(key)) throw new Error("invalid storage key");
    const normalized = path.posix.normalize(key);
    if (normalized.startsWith("..") || normalized.includes("/../")) {
      throw new Error("invalid storage key");
    }
    const rootResolved = resolve(this.rootDir);
    const fullPath = resolve(rootResolved, normalized);
    if (
      fullPath !== rootResolved &&
      !fullPath.startsWith(rootResolved + path.sep)
    ) {
      throw new Error("invalid storage key");
    }
    // Reject symlinks: even if the resolved name lives under uploads root,
    // a symlink there could point at any path on the filesystem. lstat()
    // (not stat()) inspects the link itself rather than its target.
    try {
      const stat = await lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error("invalid storage key");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return; // already gone — idempotent
      throw err;
    }
    try {
      await unlink(fullPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }
  }
}

/**
 * Cloudinary-backed storage. The public_id we store as `key` is exactly the
 * scope-prefixed path the local driver would have used (`avatar/<uuid>`),
 * so existing DB rows that hold a key are interchangeable between drivers
 * for *future* uploads. Old local-driver files won't migrate themselves —
 * a follow-up batch script will be needed for full transition.
 *
 * Per-scope post-upload transforms:
 *   - avatar: face-aware crop, three discrete sizes (64/128/512) returned
 *     in `variants` so the FE can pick the fit.
 *   - bug / receipt: hard cap at 1600px on the longer side + auto:good
 *     quality so QA screenshots and phone-camera receipts don't bloat the
 *     CDN. Conservative enough that text stays readable.
 *   - resume / payslip / chat docs / audio: untouched — they're delivered
 *     verbatim.
 */
class CloudinaryStorage implements FileStorage {
  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  private uploadOptions(
    scope: StorageScope,
    publicId: string,
    mime: string,
  ): Record<string, unknown> {
    const isImage = isImageMime(mime);
    const opts: Record<string, unknown> = {
      public_id: publicId,
      // `raw` for non-images preserves original bytes (PDF, audio, zip).
      // `image` for actual images — unlocks transformations + auto format.
      resource_type: isImage ? "image" : "raw",
      overwrite: false,
      use_filename: false,
      unique_filename: false,
    };

    if (scope === "avatar" && isImage) {
      // Pre-crop to a 512² face-aware square at upload time so all later
      // transformations downscale a clean source. Quality auto:good keeps
      // file size sensible without visible artefacts.
      opts.eager = [
        { width: 64, height: 64, crop: "thumb", gravity: "face", quality: "auto:good" },
        { width: 128, height: 128, crop: "thumb", gravity: "face", quality: "auto:good" },
        { width: 512, height: 512, crop: "thumb", gravity: "face", quality: "auto:good" },
      ];
      opts.eager_async = false;
      opts.transformation = [
        { width: 512, height: 512, crop: "thumb", gravity: "face", quality: "auto:good" },
      ];
    } else if ((scope === "bug" || scope === "receipt") && isImage) {
      // Compress + downsize. `c_limit` only shrinks; small images stay
      // small. fetch_format auto = WebP/AVIF where the browser supports it.
      opts.transformation = [
        { width: 1600, height: 1600, crop: "limit", quality: "auto:good", fetch_format: "auto" },
      ];
    }
    return opts;
  }

  async save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile> {
    validateScopeMime(scope, file.mimeType);
    // Use scope/<userId>-<uuid> as the public_id — matches the local layout
    // so DB-stored keys are portable and the directory listing in the
    // Cloudinary dashboard reads naturally.
    const publicId = `${scope}/${userId}-${uuid()}`;
    const options = this.uploadOptions(scope, publicId, file.mimeType);

    const result: UploadApiResponse = await new Promise((resolveUpload, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, res) => {
        if (err || !res) reject(err ?? new Error("cloudinary upload returned no result"));
        else resolveUpload(res);
      });
      stream.end(file.buffer);
    });

    const out: SavedFile = {
      key: result.public_id,
      url: result.secure_url,
      contentType: file.mimeType,
      size: result.bytes ?? file.buffer.length,
    };
    if (scope === "avatar" && isImageMime(file.mimeType)) {
      out.variants = {
        small: cloudinary.url(result.public_id, {
          secure: true,
          transformation: [
            { width: 64, height: 64, crop: "thumb", gravity: "face" },
            { quality: "auto:good", fetch_format: "auto" },
          ],
        }),
        medium: cloudinary.url(result.public_id, {
          secure: true,
          transformation: [
            { width: 128, height: 128, crop: "thumb", gravity: "face" },
            { quality: "auto:good", fetch_format: "auto" },
          ],
        }),
        large: cloudinary.url(result.public_id, {
          secure: true,
          transformation: [
            { width: 512, height: 512, crop: "thumb", gravity: "face" },
            { quality: "auto:good", fetch_format: "auto" },
          ],
        }),
      };
    }
    return out;
  }

  async delete(key: string): Promise<void> {
    if (typeof key !== "string" || key.length === 0) return;
    // Resource type matters for delete; we infer from the suffix-less key
    // not knowing the original mime. Try both — Cloudinary returns
    // `not_found` rather than throwing for a missing asset on either type.
    const tryDelete = async (resourceType: "image" | "raw") => {
      try {
        await cloudinary.uploader.destroy(key, {
          resource_type: resourceType,
          invalidate: true,
        });
      } catch {
        // best-effort
      }
    };
    await tryDelete("image");
    await tryDelete("raw");
  }
}

export function createFileStorage(): FileStorage {
  // Tests must never reach a real Cloudinary account, regardless of what the
  // surrounding dev `.env` says — otherwise a developer who pastes
  // production-shaped Cloudinary creds into `.env` will start uploading
  // junk on every test run. NODE_ENV=test forces the local driver.
  if (process.env.NODE_ENV === "test") {
    const root = resolve(process.env.UPLOADS_DIR ?? config.UPLOADS_DIR);
    const base = process.env.PUBLIC_BASE_URL ?? config.PUBLIC_BASE_URL;
    return new LocalStorage(root, base);
  }

  // process.env wins so test setups that mutate it per-test pick up the new
  // value without the cached `config` object getting in the way.
  const driver =
    (process.env.STORAGE_DRIVER as "local" | "cloudinary" | undefined) ??
    config.STORAGE_DRIVER;
  if (driver === "cloudinary") {
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME ?? config.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      process.env.CLOUDINARY_API_KEY ?? config.CLOUDINARY_API_KEY;
    const apiSecret =
      process.env.CLOUDINARY_API_SECRET ?? config.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        "STORAGE_DRIVER=cloudinary requires CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET",
      );
    }
    return new CloudinaryStorage(cloudName, apiKey, apiSecret);
  }
  const root = resolve(process.env.UPLOADS_DIR ?? config.UPLOADS_DIR);
  const base = process.env.PUBLIC_BASE_URL ?? config.PUBLIC_BASE_URL;
  return new LocalStorage(root, base);
}
