import multer from "multer";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ValidationError } from "../lib/errors.js";

const AVATAR_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const RESUME_MIME = ["application/pdf"];
const RECEIPT_MIME = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const CHAT_ATTACHMENT_MIME = [
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
  // Voice messages — recorded in-browser via MediaRecorder. Chrome/Firefox
  // produce webm (Opus); Safari produces mp4 (AAC). Both are streamable in
  // the FE <audio> tag.
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/ogg",
];

const BUG_IMAGE_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

/**
 * `fileFilter` runs against the *client-supplied* mimetype, which is
 * trivially spoofable. It still gates the obvious cases early (bouncing the
 * upload before buffering 10MB), but the authoritative check is the
 * post-multer magic-byte sniff in `enforceMimeMatch`.
 */
function fileFilter(allowed: readonly string[]) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new ValidationError(`unsupported mime type: ${file.mimetype}`) as unknown as Error);
  };
}

// ─── Magic-byte sniffing ────────────────────────────────────────────────
/**
 * Per-mime magic-byte signatures. `null` slots in the byte arrays mean
 * "match anything at this offset" — used by container formats like RIFF
 * where the size field sits between the leading and trailing markers.
 *
 * We only sniff the first 12 bytes; that's enough to disambiguate every
 * mime we currently allow without having to parse format internals.
 */
type Signature = readonly (number | null)[];
const SIGNATURES: Record<string, Signature[]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/jpg": [[0xff, 0xd8, 0xff]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  "image/webp": [
    // "RIFF????WEBP"
    [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  ],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
  "application/zip": [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06], // empty archive
    [0x50, 0x4b, 0x07, 0x08], // spanned
  ],
  // OOXML (docx/xlsx) and the legacy Office binary formats share their
  // container with zip / OLE2 respectively. We also accept the zip
  // signature for OOXML since that's exactly what they are on disk.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  // OLE2 compound document — .doc / .xls.
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  "application/vnd.ms-excel": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  // Audio containers.
  "audio/mpeg": [
    [0x49, 0x44, 0x33], // ID3-tagged MP3
    [0xff, 0xfb], // MPEG-1 Layer 3 frame
    [0xff, 0xf3],
    [0xff, 0xf2],
  ],
  "audio/ogg": [[0x4f, 0x67, 0x67, 0x53]], // "OggS"
  "audio/webm": [[0x1a, 0x45, 0xdf, 0xa3]], // EBML header (Matroska/WebM)
  "audio/mp4": [
    // ISO BMFF: bytes 4..7 are "ftyp"; the brand follows. We skip the
    // size prefix and match "ftyp" at offset 4.
    [null, null, null, null, 0x66, 0x74, 0x79, 0x70],
  ],
  "audio/aac": [
    [0xff, 0xf1], // ADTS, MPEG-4
    [0xff, 0xf9], // ADTS, MPEG-2
    [0x49, 0x44, 0x33], // ADTS with leading ID3 tag
  ],
  // Plain text formats have no magic bytes — accept anything (fileFilter's
  // mime allow-list is the only line of defense for these).
  "text/plain": [],
  "text/csv": [],
};

function bufferMatches(buf: Buffer, sig: Signature): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    const expected = sig[i];
    if (expected === null) continue;
    if (buf[i] !== expected) return false;
  }
  return true;
}

function sniffMatches(mime: string, buf: Buffer): boolean {
  const sigs = SIGNATURES[mime];
  if (sigs === undefined) {
    // Unknown mime — caller must have allow-listed it; if we have no
    // signature on file, refuse rather than wave it through.
    return false;
  }
  if (sigs.length === 0) return true; // text formats: no sniff possible
  return sigs.some((s) => bufferMatches(buf, s));
}

const SCOPE_ALLOW: Record<string, readonly string[]> = {
  avatar: AVATAR_MIME,
  resume: RESUME_MIME,
  receipt: RECEIPT_MIME,
  chat: CHAT_ATTACHMENT_MIME,
  bug: BUG_IMAGE_MIME,
};

/**
 * Express middleware: after multer has populated `req.file` /
 * `req.files`, verify each buffer's leading bytes match the signature
 * expected for its claimed mimetype. Defends against a client lying about
 * Content-Type to slip an executable past `fileFilter`.
 */
export function enforceMimeMatch(scope: keyof typeof SCOPE_ALLOW): RequestHandler {
  const allow = SCOPE_ALLOW[scope] ?? [];
  return (req: Request, res: Response, next: NextFunction) => {
    const collected: Express.Multer.File[] = [];
    const single = (req as Request & { file?: Express.Multer.File }).file;
    if (single) collected.push(single);
    const multi = (req as Request & {
      files?:
        | Express.Multer.File[]
        | Record<string, Express.Multer.File[]>;
    }).files;
    if (Array.isArray(multi)) {
      collected.push(...multi);
    } else if (multi && typeof multi === "object") {
      for (const arr of Object.values(multi)) collected.push(...arr);
    }
    for (const f of collected) {
      if (!allow.includes(f.mimetype)) {
        return next(
          new ValidationError(`unsupported mime type: ${f.mimetype}`),
        );
      }
      // Read up to 12 bytes — every signature we care about is shorter.
      const head = f.buffer.subarray(0, 12);
      if (!sniffMatches(f.mimetype, head)) {
        return next(
          new ValidationError(
            `file content does not match declared type ${f.mimetype}`,
          ),
        );
      }
    }
    next();
  };
}

// ─── Multer steps + chained exports ─────────────────────────────────────
// Each `*Multer` export is the bare multer middleware (fileFilter +
// memoryStorage + size limit). The default uploader name (e.g.
// `uploadAvatar`) chains the multer step with `enforceMimeMatch` so that
// existing routes pick up magic-byte verification automatically.

const avatarMulter: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: fileFilter(AVATAR_MIME),
}).single("file");

const resumeMulter: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(RESUME_MIME),
}).single("file");

const receiptMulter: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(RECEIPT_MIME),
}).single("file");

const chatAttachmentMulter: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: fileFilter(CHAT_ATTACHMENT_MIME),
}).single("file");

const bugImageMulter: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(BUG_IMAGE_MIME),
}).single("image");

/**
 * Compose multer + enforceMimeMatch into a single `RequestHandler` so that
 * routes which invoke the uploader as a function (e.g.
 * `(req,res,next) => uploadAvatar(req,res,next)` in the registration
 * route) keep working without a route-level change.
 */
function chain(...handlers: RequestHandler[]): RequestHandler {
  return (req, res, next) => {
    let i = 0;
    const run = (err?: unknown): void => {
      if (err) return next(err);
      const h = handlers[i++];
      if (!h) return next();
      h(req, res, run);
    };
    run();
  };
}

export const uploadAvatarMulter = avatarMulter;
export const uploadResumeMulter = resumeMulter;
export const uploadReceiptMulter = receiptMulter;
export const uploadChatAttachmentMulter = chatAttachmentMulter;
export const uploadBugImageMulter = bugImageMulter;

export const uploadAvatar: RequestHandler = chain(
  avatarMulter,
  enforceMimeMatch("avatar"),
);
export const uploadResume: RequestHandler = chain(
  resumeMulter,
  enforceMimeMatch("resume"),
);
export const uploadReceipt: RequestHandler = chain(
  receiptMulter,
  enforceMimeMatch("receipt"),
);
export const uploadChatAttachment: RequestHandler = chain(
  chatAttachmentMulter,
  enforceMimeMatch("chat"),
);
export const uploadBugImage: RequestHandler = chain(
  bugImageMulter,
  enforceMimeMatch("bug"),
);
