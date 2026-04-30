import multer from "multer";
import type { Request } from "express";
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
];

function fileFilter(allowed: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new ValidationError(`unsupported mime type: ${file.mimetype}`) as unknown as Error);
  };
}

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: fileFilter(AVATAR_MIME),
}).single("file");

export const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(RESUME_MIME),
}).single("file");

export const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(RECEIPT_MIME),
}).single("file");

export const uploadChatAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: fileFilter(CHAT_ATTACHMENT_MIME),
}).single("file");
