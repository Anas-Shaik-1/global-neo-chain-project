import type { Request, Response, NextFunction } from "express";
import * as svc from "./tasks.service.js";
import { ForbiddenError, ValidationError } from "../../lib/errors.js";
import { TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority } from "../../models/task.model.js";

function requireUser(req: Request): svc.Viewer {
  if (!req.user) throw new ForbiddenError();
  return req.user;
}

export async function getProjectsList(req: Request, res: Response, next: NextFunction) {
  try {
    const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await svc.listProjects({ page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await svc.createProject(req.validated as svc.CreateProjectInput);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

export async function getProjectOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanAccessProject(id, me);
    const project = await svc.getProject(id);
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function getProjectTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const status =
      typeof req.query.status === "string" && (TASK_STATUSES as readonly string[]).includes(req.query.status)
        ? (req.query.status as TaskStatus)
        : undefined;
    const priority =
      typeof req.query.priority === "string" && (TASK_PRIORITIES as readonly string[]).includes(req.query.priority)
        ? (req.query.priority as TaskPriority)
        : undefined;
    const assigneeId = typeof req.query.assignee === "string" ? req.query.assignee : undefined;
    if (assigneeId !== undefined && !/^[0-9a-fA-F]{24}$/.test(assigneeId)) {
      throw new ValidationError("assignee must be a 24-char hex ObjectId");
    }
    await svc.assertCanAccessProject(id, me);
    const tasks = await svc.listTasks(id, { status, priority, assigneeId });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function postTask(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as svc.CreateTaskInput;
    // Task creation is open to any authenticated user (matches the product
    // contract — the project becomes "joinable" once you file work in it).
    // If the body specifies a parentTaskId we still require write standing
    // on that parent so users can't bolt subtasks onto a task they have no
    // business editing.
    if (body.parentTaskId) {
      await svc.assertCanModifyTask(body.parentTaskId, me);
    }
    const task = await svc.createTask(body, me.id);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function getTaskOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanReadTask(id, me);
    const task = await svc.getTask(id);
    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function patchTask(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanModifyTask(id, me);
    const task = await svc.updateTask(id, req.validated as svc.UpdateTaskInput, me.id);
    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function getTaskComments(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanReadTask(id, me);
    const comments = await svc.listComments(id);
    res.json(comments);
  } catch (err) {
    next(err);
  }
}

export async function postTaskComment(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanModifyTask(id, me);
    const body = (req.validated as { body: string }).body;
    const comment = await svc.addComment(id, me.id, body);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

export async function getTaskActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanReadTask(id, me);
    const activity = await svc.listActivity(id);
    res.json(activity);
  } catch (err) {
    next(err);
  }
}

export async function getTaskSubtasks(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    await svc.assertCanReadTask(id, me);
    const subtasks = await svc.listSubtasks(id);
    res.json(subtasks);
  } catch (err) {
    next(err);
  }
}
