import { Types } from "mongoose";
import { Project, type ProjectDoc } from "../../models/project.model.js";
import {
  Task,
  type TaskDoc,
  type TaskStatus,
  type TaskPriority,
} from "../../models/task.model.js";
import { TaskComment, type TaskCommentDoc } from "../../models/taskComment.model.js";
import {
  TaskActivity,
  type TaskActivityDoc,
  type TaskActivityKind,
} from "../../models/taskActivity.model.js";
import { User } from "../../models/user.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

async function notifyTaskAssigned(args: {
  assigneeId: string;
  creatorId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
}): Promise<void> {
  // Don't notify a user about a task they assigned to themselves.
  if (args.assigneeId === args.creatorId) return;
  const { notify } = await import("../notifications/notifications.service.js");
  await notify(args.assigneeId, {
    kind: "TASK_ASSIGNED",
    title: `New task: ${args.taskTitle}`,
    body: `In ${args.projectName}`,
    link: `/tasks?project=${args.projectId}`,
  });
}

export interface ProjectResponseShape {
  id: string;
  name: string;
  key: string;
  description: string | null;
  taskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResponseShape {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByName: string | null;
  dueDate: Date | null;
  parentTaskId: string | null;
  subtaskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentResponseShape {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: Date;
}

export interface TaskActivityResponseShape {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string | null;
  kind: TaskActivityKind;
  fromValue: string | null;
  toValue: string | null;
  summary: string | null;
  createdAt: Date;
}

function toProjectShape(p: ProjectDoc, taskCount: number): ProjectResponseShape {
  const t = p as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: p._id.toString(),
    name: p.name,
    key: p.key,
    description: p.description ?? null,
    taskCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

interface DenormContext {
  userNames: Map<string, string>;
  projectInfo: Map<string, { key: string; name: string }>;
  subtaskCounts: Map<string, number>;
}

function denormalizeTask(t: TaskDoc, ctx: DenormContext): TaskResponseShape {
  const ts = t as unknown as { createdAt: Date; updatedAt: Date };
  const projectKey = ctx.projectInfo.get(t.projectId.toString())?.key ?? "";
  const projectName = ctx.projectInfo.get(t.projectId.toString())?.name ?? "";
  return {
    id: t._id.toString(),
    projectId: t.projectId.toString(),
    projectKey,
    projectName,
    title: t.title,
    description: t.description ?? null,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    assigneeId: t.assigneeId ? t.assigneeId.toString() : null,
    assigneeName: t.assigneeId ? ctx.userNames.get(t.assigneeId.toString()) ?? null : null,
    createdById: t.createdById.toString(),
    createdByName: ctx.userNames.get(t.createdById.toString()) ?? null,
    dueDate: t.dueDate ?? null,
    parentTaskId: t.parentTaskId ? t.parentTaskId.toString() : null,
    subtaskCount: ctx.subtaskCounts.get(t._id.toString()) ?? 0,
    createdAt: ts.createdAt,
    updatedAt: ts.updatedAt,
  };
}

function denormalizeComment(c: TaskCommentDoc, userNames: Map<string, string>): CommentResponseShape {
  const cs = c as unknown as { createdAt: Date };
  return {
    id: c._id.toString(),
    taskId: c.taskId.toString(),
    authorId: c.authorId.toString(),
    authorName: userNames.get(c.authorId.toString()) ?? null,
    body: c.body,
    createdAt: cs.createdAt,
  };
}

function denormalizeActivity(
  a: TaskActivityDoc,
  userNames: Map<string, string>,
): TaskActivityResponseShape {
  const as_ = a as unknown as { createdAt: Date };
  return {
    id: a._id.toString(),
    taskId: a.taskId.toString(),
    actorId: a.actorId.toString(),
    actorName: userNames.get(a.actorId.toString()) ?? null,
    kind: a.kind as TaskActivityKind,
    fromValue: a.fromValue ?? null,
    toValue: a.toValue ?? null,
    summary: a.summary ?? null,
    createdAt: as_.createdAt,
  };
}

async function buildUserNamesMap(userIds: (Types.ObjectId | null | undefined)[]): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(userIds.filter((i): i is Types.ObjectId => !!i).map((i) => i.toString())),
  );
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const users = await User.find({ _id: { $in: ids } }).select("name").lean();
  for (const u of users) map.set(u._id.toString(), u.name);
  return map;
}

async function buildProjectInfoMap(projectIds: Types.ObjectId[]): Promise<Map<string, { key: string; name: string }>> {
  const ids = Array.from(new Set(projectIds.map((i) => i.toString())));
  const map = new Map<string, { key: string; name: string }>();
  if (ids.length === 0) return map;
  const projects = await Project.find({ _id: { $in: ids } }).select("name key").lean();
  for (const p of projects) map.set(p._id.toString(), { key: p.key, name: p.name });
  return map;
}

async function buildSubtaskCountsMap(taskIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (taskIds.length === 0) return map;
  const counts = await Task.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { parentTaskId: { $in: taskIds } } },
    { $group: { _id: "$parentTaskId", count: { $sum: 1 } } },
  ]);
  for (const c of counts) map.set(c._id.toString(), c.count);
  return map;
}

async function logActivity(input: {
  taskId: Types.ObjectId | string;
  actorId: Types.ObjectId | string;
  kind: TaskActivityKind;
  fromValue?: string | null;
  toValue?: string | null;
  summary?: string | null;
}): Promise<void> {
  await TaskActivity.create({
    taskId:
      typeof input.taskId === "string" ? new Types.ObjectId(input.taskId) : input.taskId,
    actorId:
      typeof input.actorId === "string" ? new Types.ObjectId(input.actorId) : input.actorId,
    kind: input.kind,
    fromValue: input.fromValue ?? null,
    toValue: input.toValue ?? null,
    summary: input.summary ?? null,
  });
}

function truncate(s: string | null | undefined, max = 100): string | null {
  if (s == null) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface ListProjectsInput {
  page?: number;
  limit?: number;
}

export async function listProjects(input: ListProjectsInput) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const [docs, total] = await Promise.all([
    Project.find().sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    Project.countDocuments(),
  ]);
  const counts = await Task.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { projectId: { $in: docs.map((d) => d._id) } } },
    { $group: { _id: "$projectId", count: { $sum: 1 } } },
  ]);
  const countById = new Map<string, number>();
  for (const c of counts) countById.set(c._id.toString(), c.count);
  const items = docs.map((d) => toProjectShape(d, countById.get(d._id.toString()) ?? 0));
  return { items, total, page, limit };
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectResponseShape> {
  try {
    const created = await Project.create({
      name: input.name,
      key: input.key,
      description: input.description ?? null,
    });
    return toProjectShape(created, 0);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Project with this key already exists");
    }
    throw err;
  }
}

export async function getProject(id: string): Promise<ProjectResponseShape> {
  const p = await Project.findById(id);
  if (!p) throw new NotFoundError("Project");
  const taskCount = await Task.countDocuments({ projectId: p._id });
  return toProjectShape(p, taskCount);
}

export interface ListTasksFilters {
  status?: TaskStatus;
  assigneeId?: string;
  priority?: TaskPriority;
}

export async function listTasks(projectId: string, filters: ListTasksFilters): Promise<TaskResponseShape[]> {
  const filter: Record<string, unknown> = {
    projectId: new Types.ObjectId(projectId),
    parentTaskId: null,
  };
  if (filters.status) filter.status = filters.status;
  if (filters.priority) filter.priority = filters.priority;
  if (filters.assigneeId) filter.assigneeId = new Types.ObjectId(filters.assigneeId);
  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  const userIds = tasks.flatMap((t) => [t.assigneeId, t.createdById]);
  const userNames = await buildUserNamesMap(userIds);
  const projectInfo = await buildProjectInfoMap(tasks.map((t) => t.projectId));
  const subtaskCounts = await buildSubtaskCountsMap(tasks.map((t) => t._id));
  return tasks.map((t) => denormalizeTask(t, { userNames, projectInfo, subtaskCounts }));
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  parentTaskId?: string | null;
}

export async function createTask(input: CreateTaskInput, createdById: string): Promise<TaskResponseShape> {
  const project = await Project.findById(input.projectId);
  if (!project) throw new NotFoundError("Project");
  let parentTaskId: Types.ObjectId | null = null;
  if (input.parentTaskId) {
    const parent = await Task.findById(input.parentTaskId);
    if (!parent) throw new NotFoundError("Parent task");
    parentTaskId = parent._id;
  }
  const created = await Task.create({
    projectId: new Types.ObjectId(input.projectId),
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? "MEDIUM",
    assigneeId: input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
    createdById: new Types.ObjectId(createdById),
    dueDate: input.dueDate ?? null,
    parentTaskId,
  });
  await logActivity({
    taskId: created._id,
    actorId: createdById,
    kind: "CREATED",
    toValue: created.title,
    summary: "created the task",
  });
  const userNames = await buildUserNamesMap([created.assigneeId, created.createdById]);
  const projectInfo = new Map<string, { key: string; name: string }>([
    [project._id.toString(), { key: project.key, name: project.name }],
  ]);
  const subtaskCounts = new Map<string, number>();
  if (created.assigneeId) {
    void notifyTaskAssigned({
      assigneeId: created.assigneeId.toString(),
      creatorId: createdById,
      taskTitle: created.title,
      projectId: project._id.toString(),
      projectName: project.name,
    }).catch((err) => logger.warn({ err }, "tasks.createTask notify failed"));
  }
  return denormalizeTask(created, { userNames, projectInfo, subtaskCounts });
}

export async function getTask(id: string): Promise<TaskResponseShape> {
  const t = await Task.findById(id);
  if (!t) throw new NotFoundError("Task");
  const userNames = await buildUserNamesMap([t.assigneeId, t.createdById]);
  const projectInfo = await buildProjectInfoMap([t.projectId]);
  const subtaskCounts = await buildSubtaskCountsMap([t._id]);
  return denormalizeTask(t, { userNames, projectInfo, subtaskCounts });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export async function updateTask(
  id: string,
  patch: UpdateTaskInput,
  actorId?: string,
): Promise<TaskResponseShape> {
  const before = await Task.findById(id);
  if (!before) throw new NotFoundError("Task");

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.assigneeId !== undefined) {
    update.assigneeId = patch.assigneeId ? new Types.ObjectId(patch.assigneeId) : null;
  }
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate;

  const t = await Task.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!t) throw new NotFoundError("Task");

  if (actorId) {
    if (patch.status !== undefined && patch.status !== before.status) {
      await logActivity({
        taskId: t._id,
        actorId,
        kind: "STATUS_CHANGED",
        fromValue: before.status,
        toValue: patch.status,
      });
    }
    if (patch.priority !== undefined && patch.priority !== before.priority) {
      await logActivity({
        taskId: t._id,
        actorId,
        kind: "PRIORITY_CHANGED",
        fromValue: before.priority,
        toValue: patch.priority,
      });
    }
    if (patch.title !== undefined && patch.title !== before.title) {
      await logActivity({
        taskId: t._id,
        actorId,
        kind: "TITLE_CHANGED",
        fromValue: truncate(before.title),
        toValue: truncate(patch.title),
      });
    }
    if (patch.assigneeId !== undefined) {
      const oldId = before.assigneeId ? before.assigneeId.toString() : null;
      const newId = patch.assigneeId ?? null;
      if (oldId !== newId) {
        const lookupIds: Types.ObjectId[] = [];
        if (before.assigneeId) lookupIds.push(before.assigneeId);
        if (newId) lookupIds.push(new Types.ObjectId(newId));
        const names = await buildUserNamesMap(lookupIds);
        await logActivity({
          taskId: t._id,
          actorId,
          kind: "ASSIGNED",
          fromValue: oldId ? names.get(oldId) ?? "unassigned" : "unassigned",
          toValue: newId ? names.get(newId) ?? "unassigned" : "unassigned",
        });
        // Notify the new assignee (if any). Skip if they're the actor.
        if (newId) {
          const proj = await Project.findById(t.projectId).select("name").lean();
          void notifyTaskAssigned({
            assigneeId: newId,
            creatorId: actorId,
            taskTitle: t.title,
            projectId: t.projectId.toString(),
            projectName: proj?.name ?? "a project",
          }).catch((err) => logger.warn({ err }, "tasks.updateTask notify failed"));
        }
      }
    }
    if (patch.dueDate !== undefined) {
      const oldD = before.dueDate ? before.dueDate.toISOString() : null;
      const newD = patch.dueDate ? new Date(patch.dueDate).toISOString() : null;
      if (oldD !== newD) {
        await logActivity({
          taskId: t._id,
          actorId,
          kind: "DUE_DATE_CHANGED",
          fromValue: oldD,
          toValue: newD,
        });
      }
    }
  }

  const userNames = await buildUserNamesMap([t.assigneeId, t.createdById]);
  const projectInfo = await buildProjectInfoMap([t.projectId]);
  const subtaskCounts = await buildSubtaskCountsMap([t._id]);
  return denormalizeTask(t, { userNames, projectInfo, subtaskCounts });
}

export async function listComments(taskId: string): Promise<CommentResponseShape[]> {
  const comments = await TaskComment.find({ taskId: new Types.ObjectId(taskId) }).sort({ createdAt: 1 });
  const userNames = await buildUserNamesMap(comments.map((c) => c.authorId));
  return comments.map((c) => denormalizeComment(c, userNames));
}

export async function addComment(taskId: string, authorId: string, body: string): Promise<CommentResponseShape> {
  const task = await Task.findById(taskId);
  if (!task) throw new NotFoundError("Task");
  const created = await TaskComment.create({
    taskId: new Types.ObjectId(taskId),
    authorId: new Types.ObjectId(authorId),
    body,
  });
  await logActivity({
    taskId: task._id,
    actorId: authorId,
    kind: "COMMENTED",
    summary: body.slice(0, 100),
  });
  const userNames = await buildUserNamesMap([created.authorId]);
  return denormalizeComment(created, userNames);
}

export async function listActivity(taskId: string): Promise<TaskActivityResponseShape[]> {
  const task = await Task.findById(taskId);
  if (!task) throw new NotFoundError("Task");
  const items = await TaskActivity.find({ taskId: new Types.ObjectId(taskId) }).sort({
    createdAt: -1,
  });
  const userNames = await buildUserNamesMap(items.map((i) => i.actorId));
  return items.map((i) => denormalizeActivity(i, userNames));
}

export async function listSubtasks(parentTaskId: string): Promise<TaskResponseShape[]> {
  const parent = await Task.findById(parentTaskId);
  if (!parent) throw new NotFoundError("Task");
  const tasks = await Task.find({ parentTaskId: new Types.ObjectId(parentTaskId) }).sort({
    createdAt: 1,
  });
  const userIds = tasks.flatMap((t) => [t.assigneeId, t.createdById]);
  const userNames = await buildUserNamesMap(userIds);
  const projectInfo = await buildProjectInfoMap(tasks.map((t) => t.projectId));
  const subtaskCounts = await buildSubtaskCountsMap(tasks.map((t) => t._id));
  return tasks.map((t) => denormalizeTask(t, { userNames, projectInfo, subtaskCounts }));
}
