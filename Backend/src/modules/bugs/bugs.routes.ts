import { Router } from "express";
import * as ctl from "./bugs.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { uploadBugImage } from "../../middleware/upload.js";
import { CreateBugBody, UpdateBugBody } from "./bugs.schema.js";

export const bugsRouter = Router();

// Every endpoint requires auth — viewing the bug log is open to all
// authenticated users. Anyone can file a new bug (open across the org so any
// teammate can flag a regression they spotted); editing / image upload still
// gate to the bug's reporter or an ADMIN at the service layer.
bugsRouter.use(requireAuth);

bugsRouter.get("/", ctl.getList);
bugsRouter.get("/:id", ctl.getOne);

bugsRouter.post("/", validate(CreateBugBody), ctl.postCreate);
bugsRouter.patch("/:id", validate(UpdateBugBody), ctl.patchOne);

bugsRouter.post(
  "/:id/image",
  uploadBugImage,
  ctl.postImage,
);
