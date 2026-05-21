import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import { User } from "../../models/user.model.js";
import { issueTokensFor } from "./auth.service.js";
import { setRefreshCookie } from "./auth.controller.js";

/**
 * Zoho OAuth 2 flow — works for both sign-in and sign-up:
 *   1. /auth/zoho/start  → redirect to Zoho's authorize page with a state
 *      cookie that we verify on return.
 *   2. /auth/zoho/callback → exchange `code` for an access token, fetch the
 *      user's Zoho profile, find-or-create the local user, issue our own
 *      JWTs, set the refresh cookie, redirect to the FE.
 *
 * Both endpoints 404 when ZOHO_CLIENT_ID/SECRET aren't configured so a
 * deployment without Zoho credentials behaves as if the feature doesn't
 * exist at all.
 */

const STATE_COOKIE = "zoho_state";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Scopes: AaaServer.profile.READ is the documented scope for `/oauth/user/info`
// (returns the signed-in user's profile). `email` and `profile` are the
// generic OIDC-flavoured scopes Zoho also accepts.
const ZOHO_SCOPE = "AaaServer.profile.READ";

function isConfigured(): boolean {
  return Boolean(
    config.ZOHO_CLIENT_ID && config.ZOHO_CLIENT_SECRET && config.ZOHO_REDIRECT_URI,
  );
}

function notConfigured(res: Response) {
  res.status(404).json({
    error: "ZOHO_NOT_CONFIGURED",
    message:
      "Zoho OAuth is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REDIRECT_URI in the backend env.",
  });
}

export async function getZohoStart(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isConfigured()) return notConfigured(res);

    const state = crypto.randomBytes(24).toString("hex");
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      // `lax` so the cookie is sent on the top-level redirect back from Zoho.
      sameSite: "lax",
      path: "/auth/zoho",
      maxAge: STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.ZOHO_CLIENT_ID!,
      scope: ZOHO_SCOPE,
      redirect_uri: config.ZOHO_REDIRECT_URI!,
      state,
      access_type: "offline",
      prompt: "consent",
    });
    const authorizeUrl = `${config.ZOHO_ACCOUNTS_BASE_URL}/oauth/v2/auth?${params.toString()}`;
    res.redirect(authorizeUrl);
  } catch (err) {
    next(err);
  }
}

interface ZohoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  token_type?: string;
  error?: string;
}

interface ZohoUserInfo {
  // Field names follow Zoho Accounts userinfo. We treat all as optional and
  // fall back gracefully so a missing first/last name doesn't break sign-up.
  ZUID?: string;
  Email?: string;
  email?: string;
  First_Name?: string;
  first_name?: string;
  Last_Name?: string;
  last_name?: string;
  Display_Name?: string;
  display_name?: string;
  name?: string;
}

async function exchangeCodeForToken(code: string): Promise<ZohoTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.ZOHO_CLIENT_ID!,
    client_secret: config.ZOHO_CLIENT_SECRET!,
    redirect_uri: config.ZOHO_REDIRECT_URI!,
    code,
  });
  const res = await fetch(`${config.ZOHO_ACCOUNTS_BASE_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoho token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as ZohoTokenResponse;
}

async function fetchZohoUser(accessToken: string): Promise<ZohoUserInfo> {
  const res = await fetch(`${config.ZOHO_ACCOUNTS_BASE_URL}/oauth/user/info`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoho userinfo failed (${res.status}): ${text}`);
  }
  return (await res.json()) as ZohoUserInfo;
}

function pickEmail(profile: ZohoUserInfo): string | null {
  return (profile.Email ?? profile.email ?? "").toLowerCase().trim() || null;
}

function pickName(profile: ZohoUserInfo, fallback: string): string {
  const display = profile.Display_Name ?? profile.display_name ?? profile.name;
  if (display && display.trim()) return display.trim();
  const first = profile.First_Name ?? profile.first_name ?? "";
  const last = profile.Last_Name ?? profile.last_name ?? "";
  const composed = `${first} ${last}`.trim();
  return composed || fallback;
}

function frontendRedirect(path: string, query: Record<string, string> = {}): string {
  const url = new URL(path, config.FRONTEND_ORIGIN);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url.toString();
}

export async function getZohoCallback(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isConfigured()) return notConfigured(res);

    const { code, state, error } = req.query as Record<string, string | undefined>;
    const expectedState = req.cookies?.[STATE_COOKIE] as string | undefined;
    res.clearCookie(STATE_COOKIE, { path: "/auth/zoho" });

    if (error) {
      return res.redirect(frontendRedirect("/login", { error: `zoho_${error}` }));
    }
    if (!code) {
      return res.redirect(frontendRedirect("/login", { error: "zoho_missing_code" }));
    }
    if (!state || !expectedState || state !== expectedState) {
      return res.redirect(frontendRedirect("/login", { error: "zoho_state_mismatch" }));
    }

    const tokenRes = await exchangeCodeForToken(code);
    if (!tokenRes.access_token) {
      logger.warn({ tokenRes }, "zoho: token exchange returned no access_token");
      return res.redirect(frontendRedirect("/login", { error: "zoho_token_failed" }));
    }

    const profile = await fetchZohoUser(tokenRes.access_token);
    const email = pickEmail(profile);
    if (!email) {
      logger.warn({ profile }, "zoho: profile missing email");
      return res.redirect(frontendRedirect("/login", { error: "zoho_no_email" }));
    }

    // Find-or-create. Existing users with the same email are linked
    // (effectively "log in"). New users land as ACTIVE EMPLOYEEs — Zoho
    // already attests to the email so we skip the HR/Admin approval gate
    // on this path. Tighten if your tenancy model requires otherwise.
    let user = await User.findOne({ email });
    if (!user) {
      const fallbackName = email.split("@")[0] || "User";
      const name = pickName(profile, fallbackName);
      // Set an unguessable random password so the bcrypt-required field is
      // satisfied; the user will never know it. They can set a real one
      // later via /auth/password-reset/request.
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      user = await User.create({
        email,
        name,
        passwordHash,
        role: "EMPLOYEE",
        approvalStatus: "ACTIVE",
        isActive: true,
        isVerified: true,
        mustChangePassword: false,
      });
    } else {
      if (user.isActive === false) {
        return res.redirect(frontendRedirect("/login", { error: "account_inactive" }));
      }
      if (user.approvalStatus !== "ACTIVE") {
        return res.redirect(frontendRedirect("/login", { error: "account_pending" }));
      }
    }

    const fullUser = await User.findById(user._id).select(
      "+passwordHash +totpSecret",
    );
    if (!fullUser) {
      return res.redirect(frontendRedirect("/login", { error: "zoho_user_lookup" }));
    }

    // If the user has TOTP enabled, fall back to the password+code flow —
    // we don't want a second auth factor bypassed by a social provider.
    if (fullUser.totpEnabled) {
      return res.redirect(
        frontendRedirect("/login", { info: "zoho_totp_use_password" }),
      );
    }

    const { refreshToken } = await issueTokensFor(fullUser as never);
    setRefreshCookie(res, refreshToken);
    // FE bootstraps the access token from the refresh cookie via /auth/refresh
    // when it lands on a protected route (see useBootstrapSession). Sending
    // the user straight to the dashboard avoids exposing the access token in
    // a query string.
    res.redirect(frontendRedirect("/dashboard"));
  } catch (err) {
    logger.error({ err }, "zoho callback failed");
    res.redirect(frontendRedirect("/login", { error: "zoho_failed" }));
  }
}

export function isZohoConfigured(): boolean {
  return isConfigured();
}
