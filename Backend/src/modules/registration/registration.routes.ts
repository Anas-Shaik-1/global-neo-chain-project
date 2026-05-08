import { Router } from "express";
import { postRegister, getRegistrationStatus } from "./registration.controller.js";
import { uploadAvatar } from "../../middleware/upload.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const registrationRouter = Router();

// Both endpoints are public — registration must work for users who don't yet
// have an account. authLimiter caps brute-force enumeration of registered
// emails on the status lookup. The register endpoint is multipart now (see
// schema) so the avatar file rides along on the same request — multer parses
// the file off `avatar` field; the controller re-runs Zod on the text body.
registrationRouter.post(
  "/register",
  authLimiter,
  // Reuse the same `uploadAvatar` middleware as the avatar-update route — it
  // already enforces 2 MB max and the avatar mime allowlist. We only changed
  // the field name to `avatar` for clarity at this layer.
  (req, res, next) => uploadAvatar(req, res, next),
  postRegister,
);
registrationRouter.get("/registration-status", authLimiter, getRegistrationStatus);
