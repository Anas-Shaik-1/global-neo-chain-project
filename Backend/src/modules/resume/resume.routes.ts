import { Router } from "express";
import * as ctl from "./resume.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { uploadResume } from "../../middleware/upload.js";
import { ImportResumeBody, ResumeBody } from "./resume.schema.js";

export const resumeRouter = Router();

// All resume routes are owner-only — every authenticated role can build,
// save, and download their own. There's no cross-user read endpoint
// here on purpose; if HR / clients ever need a roster export, that
// belongs behind a separate, audited admin endpoint.
resumeRouter.use(requireAuth);

resumeRouter.get("/me", ctl.getMine);
resumeRouter.put("/me", validate(ResumeBody), ctl.putMine);
resumeRouter.get("/me/pdf", ctl.getMinePdf);
// Import-from-text — parses pasted resume text into the editor shape
// without saving. The FE then lets the user review and apply.
resumeRouter.post("/me/import", validate(ImportResumeBody), ctl.postImport);
// Import-from-PDF — multipart upload (single `file` field, max 5 MB,
// magic-byte verified by the shared `uploadResume` middleware).
// Bytes live in memory only; nothing is persisted.
resumeRouter.post("/me/import-pdf", uploadResume, ctl.postImportPdf);
