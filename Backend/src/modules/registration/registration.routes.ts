import { Router } from "express";
import { postRegister, getRegistrationStatus } from "./registration.controller.js";
import { validate } from "../../middleware/validate.js";
import { RegisterBody } from "./registration.schema.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const registrationRouter = Router();

// Both endpoints are public — registration must work for users who don't yet
// have an account. authLimiter caps brute-force enumeration of registered
// emails on the status lookup.
registrationRouter.post("/register", authLimiter, validate(RegisterBody), postRegister);
registrationRouter.get("/registration-status", authLimiter, getRegistrationStatus);
