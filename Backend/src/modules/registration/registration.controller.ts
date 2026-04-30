import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./registration.service.js";
import type { RegisterBody } from "./registration.schema.js";
import { ValidationError } from "../../lib/errors.js";

type RegisterInput = z.infer<typeof RegisterBody>;

export async function postRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as RegisterInput;
    const result = await svc.register(body);
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
