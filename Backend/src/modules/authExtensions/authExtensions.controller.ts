import type { Request, Response, NextFunction } from "express";
import * as svc from "./authExtensions.service.js";
import { setRefreshCookie } from "../auth/auth.controller.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import type { z } from "zod";
import type {
  RequestPasswordResetBody,
  ConfirmPasswordResetBody,
  ChangePasswordBody,
  TotpVerifyBody,
  TotpDisableBody,
  Login2FABody,
} from "./authExtensions.schema.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function postRequestReset(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as z.infer<typeof RequestPasswordResetBody>;
    await svc.requestPasswordReset(body.email);
    // Always 204 — never reveal whether the email exists.
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postConfirmReset(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as z.infer<typeof ConfirmPasswordResetBody>;
    await svc.confirmPasswordReset(body.token, body.newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postChangePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof ChangePasswordBody>;
    await svc.changePassword(me.id, body.currentPassword, body.newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postTotpSetup(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const out = await svc.setupTotp(me.id);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postTotpVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof TotpVerifyBody>;
    const ok = await svc.verifyTotp(me.id, body.token);
    if (!ok) throw new ValidationError("Invalid TOTP code");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postTotpDisable(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof TotpDisableBody>;
    await svc.disableTotp(me.id, body.password);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postLogin2FA(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as z.infer<typeof Login2FABody>;
    const { accessToken, refreshToken, user } = await svc.loginWith2FA(
      body.email,
      body.password,
      body.token,
    );
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
}
