import { Router } from "express";
import * as ctl from "./tasks.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  CreateProjectBody,
  CreateTaskBody,
  UpdateTaskBody,
  CreateCommentBody,
} from "./tasks.schema.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", ctl.getProjectsList);
projectsRouter.post(
  "/",
  requireRole("PM", "HR", "ADMIN"),
  validate(CreateProjectBody),
  ctl.postProject,
);
projectsRouter.get("/:id", ctl.getProjectOne);
projectsRouter.get("/:id/tasks", ctl.getProjectTasks);

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.post("/", validate(CreateTaskBody), ctl.postTask);
tasksRouter.get("/:id", ctl.getTaskOne);
tasksRouter.patch("/:id", validate(UpdateTaskBody), ctl.patchTask);
tasksRouter.get("/:id/comments", ctl.getTaskComments);
tasksRouter.post("/:id/comments", validate(CreateCommentBody), ctl.postTaskComment);
