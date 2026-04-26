import rateLimit from "express-rate-limit";
import { config } from "../config/index.js";

const isTest = config.NODE_ENV === "test";

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many auth attempts" },
  skip: () => isTest,
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
});
