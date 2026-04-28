import { Router } from "express";
import * as ctl from "./calls.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { CreateCallBody } from "./calls.schema.js";

export const callsRouter = Router();

callsRouter.use(requireAuth);

callsRouter.post("/", validate(CreateCallBody), ctl.postCreateCall);
callsRouter.get("/me", ctl.getMyCalls);
callsRouter.post("/:id/end", ctl.postEndCall);
