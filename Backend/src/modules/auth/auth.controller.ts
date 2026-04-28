import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/index.js";
import {
  loginCheckCredentials,
  issueTokensFor,
  rotate,
  logout as logoutSvc,
  getMe,
} from "./auth.service.js";
import type { z } from "zod";
import type { LoginBody } from "./auth.schema.js";
import { UnauthorizedError } from "../../lib/errors.js";

type LoginInput = z.infer<typeof LoginBody>;

const REFRESH_COOKIE = "refresh";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/auth",
    maxAge: REFRESH_TTL_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
}

export async function postLogin(req: Request, res: Response, next: NextFunction) {
  try {
    // validate(LoginBody) middleware already parsed the body and put it on req.validated
    const body = req.validated as LoginInput;
    const user = await loginCheckCredentials(body.email, body.password);

    // 2FA branch: when TOTP is enabled, don't issue tokens — the FE must
    // call POST /auth/login-2fa with the TOTP code to complete the login.
    if (user.totpEnabled) {
      res.json({ requires2FA: true });
      return;
    }

    const { accessToken, refreshToken, user: pub } = await issueTokensFor(user);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: pub });
  } catch (err) {
    next(err);
  }
}

export async function postRefresh(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedError("Missing refresh cookie");
    const { accessToken, refreshToken } = await rotate(raw);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

export async function postLogout(req: Request, res: Response, next: NextFunction) {
  try {
    await logoutSvc(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getCurrent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const user = await getMe(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
