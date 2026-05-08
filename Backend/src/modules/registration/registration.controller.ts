import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./registration.service.js";
import { RegisterBody } from "./registration.schema.js";
import { ValidationError } from "../../lib/errors.js";

/**
 * Multipart entrypoint. multer parses the `avatar` file off the request and
 * the rest of the form fields land on `req.body` as strings. We re-validate
 * the text fields with the same Zod schema used for the JSON shape so the
 * server is the single source of truth for the registration contract.
 */
export async function postRegister(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new ValidationError("Profile picture is required");
    }

    // Body fields arrive as strings under multipart. Zod parses + trims.
    // `phone` is optional — multer leaves the field absent when blank.
    const parsed = RegisterBody.safeParse({
      email: req.body?.email,
      name: req.body?.name,
      password: req.body?.password,
      phone: req.body?.phone || undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.join(".") || "input";
      throw new ValidationError(`${where}: ${issue?.message ?? "invalid"}`);
    }

    const result = await svc.register({
      ...parsed.data,
      avatar: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
      },
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

const StatusQuery = z.object({ email: z.string().email() });

export async function getRegistrationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = StatusQuery.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("email query is required");
    const result = await svc.getRegistrationStatus(parsed.data.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
