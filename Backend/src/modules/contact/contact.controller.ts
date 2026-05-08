import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import type { ContactSubmissionBody } from "./contact.schema.js";
import { createContactSubmission } from "./contact.service.js";
import { logger } from "../../lib/logger.js";

type Body = z.infer<typeof ContactSubmissionBody>;

interface ValidatedRequest<T> extends Request {
  validated: T;
}

export async function postContact(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = (req as ValidatedRequest<Body>).validated;

    // Honeypot caught a bot — pretend to succeed so the bot can't iterate
    // toward bypassing the trap. Don't persist, don't email.
    if (body.website && body.website.trim().length > 0) {
      logger.info(
        { ip: req.ip, ua: req.get("user-agent") },
        "contact: honeypot triggered",
      );
      res.status(201).json({ id: "ignored", receivedAt: new Date().toISOString() });
      return;
    }

    const result = await createContactSubmission({
      name: body.name,
      email: body.email,
      company: body.company,
      message: body.message,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });

    res.status(201).json({
      id: result.id,
      receivedAt: result.receivedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
