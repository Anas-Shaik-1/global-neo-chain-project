import { Router } from "express";
import { postLogin, postRefresh, postLogout, getCurrent } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { LoginBody } from "./auth.schema.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/login", authLimiter, validate(LoginBody), postLogin);
authRouter.post("/refresh", authLimiter, postRefresh);
authRouter.post("/logout", postLogout);
authRouter.get("/me", requireAuth, getCurrent);
