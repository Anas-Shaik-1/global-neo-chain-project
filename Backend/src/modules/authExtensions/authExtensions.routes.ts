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
  VerifyEmailBody,
  VerifyPhoneBody,
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
  authLimiter,
  requireAuth,
  validate(TotpVerifyBody),
  ctl.postTotpVerify,
);
authExtensionsRouter.post(
  "/2fa/disable",
  authLimiter,
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

authExtensionsRouter.post(
  "/verify-email/request",
  requireAuth,
  ctl.postVerifyEmailRequest,
);

authExtensionsRouter.post(
  "/verify-email/confirm",
  validate(VerifyEmailBody),
  ctl.postVerifyEmailConfirm,
);

authExtensionsRouter.post(
  "/phone/request-verify",
  authLimiter,
  requireAuth,
  ctl.postPhoneRequestVerify,
);

authExtensionsRouter.post(
  "/phone/verify",
  authLimiter,
  requireAuth,
  validate(VerifyPhoneBody),
  ctl.postPhoneVerify,
);
