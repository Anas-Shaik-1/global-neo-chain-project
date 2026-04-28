import { Router } from "express";
import * as ctl from "./authExtensions.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import {
  RequestPasswordResetBody,
  ConfirmPasswordResetBody,
  ChangePasswordBody,
  TotpVerifyBody,
  TotpDisableBody,
  Login2FABody,
} from "./authExtensions.schema.js";

export const authExtensionsRouter = Router();

authExtensionsRouter.post(
  "/password-reset/request",
  authLimiter,
  validate(RequestPasswordResetBody),
  ctl.postRequestReset,
);

authExtensionsRouter.post(
  "/password-reset/confirm",
  authLimiter,
  validate(ConfirmPasswordResetBody),
  ctl.postConfirmReset,
);

authExtensionsRouter.post(
  "/password/change",
  requireAuth,
  validate(ChangePasswordBody),
  ctl.postChangePassword,
);

authExtensionsRouter.post("/2fa/setup", requireAuth, ctl.postTotpSetup);
authExtensionsRouter.post(
  "/2fa/verify",
  requireAuth,
  validate(TotpVerifyBody),
  ctl.postTotpVerify,
);
authExtensionsRouter.post(
  "/2fa/disable",
  requireAuth,
  validate(TotpDisableBody),
  ctl.postTotpDisable,
);

authExtensionsRouter.post(
  "/login-2fa",
  authLimiter,
  validate(Login2FABody),
  ctl.postLogin2FA,
);
