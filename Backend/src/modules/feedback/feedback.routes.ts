import { Router } from "express";
import * as ctl from "./feedback.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  ReviewFeedbackBody,
  SubmitFeedbackBody,
} from "./feedback.schema.js";

export const feedbackRouter = Router();

// Every route requires auth — anonymity is about whether the *displayed*
// name is hidden, not whether the system knows the submitter (it always
// does, for audit + abuse prevention).
feedbackRouter.use(requireAuth);

feedbackRouter.get("/", ctl.getList);
feedbackRouter.post("/", validate(SubmitFeedbackBody), ctl.postSubmit);
feedbackRouter.get("/:id", ctl.getOne);
feedbackRouter.post("/:id/review", validate(ReviewFeedbackBody), ctl.postReview);
