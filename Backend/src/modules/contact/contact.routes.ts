import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config/index.js";
import { validate } from "../../middleware/validate.js";
import { postContact } from "./contact.controller.js";
import { ContactSubmissionBody } from "./contact.schema.js";

const isTest = config.NODE_ENV === "test";

/** Tight rate limit: contact form is unauthenticated and hits the mail
 *  driver, so it's a natural target for spam loops. 5 submissions per IP
 *  per 15 minutes is plenty for any genuine visitor. */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many submissions. Try again later." },
  skip: () => isTest,
});

export const contactRouter = Router();

contactRouter.post(
  "/",
  contactLimiter,
  validate(ContactSubmissionBody),
  postContact,
);
