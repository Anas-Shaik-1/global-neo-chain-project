import { Router } from "express";
import { postLogin, postRefresh, postLogout, getCurrent } from "./auth.controller.js";
import { getZohoStart, getZohoCallback, isZohoConfigured } from "./zoho.controller.js";
import { validate } from "../../middleware/validate.js";
import { LoginBody } from "./auth.schema.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/login", authLimiter, validate(LoginBody), postLogin);
authRouter.post("/refresh", authLimiter, postRefresh);
authRouter.post("/logout", postLogout);
authRouter.get("/me", requireAuth, getCurrent);

// Zoho OAuth — start + callback. Both 404 when ZOHO_* env vars are missing
// so the surface is invisible until configured. The FE polls /auth/providers
// to know whether to render the "Continue with Zoho" button.
authRouter.get("/zoho/start", authLimiter, getZohoStart);
authRouter.get("/zoho/callback", getZohoCallback);

// Discovery endpoint — small, public, no auth required. The FE uses this
// to decide whether to render social-login buttons.
authRouter.get("/providers", (_req, res) => {
  res.json({ zoho: isZohoConfigured() });
});
