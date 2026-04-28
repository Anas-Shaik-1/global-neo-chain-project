import { Types } from "mongoose";
import { Project, type ProjectDoc } from "../../models/project.model.js";
import {
  Task,
  type TaskDoc,
  type TaskStatus,
  type TaskPriority,
} from "../../models/task.model.js";
import { TaskComment, type TaskCommentDoc } from "../../models/taskComment.model.js";
import { User } from "../../models/user.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

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
  const filter: Record<string, unknown> = { projectId: new Types.ObjectId(projectId) };
  if (filters.status) filter.status = filters.status;
  if (filters.priority) filter.priority = filters.priority;
  if (filters.assigneeId) filter.assigneeId = new Types.ObjectId(filters.assigneeId);
  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  const userIds = tasks.flatMap((t) => [t.assigneeId, t.createdById]);
  const userNames = await buildUserNamesMap(userIds);
  const projectInfo = await buildProjectInfoMap(tasks.map((t) => t.projectId));
  return tasks.map((t) => denormalizeTask(t, { userNames, projectInfo }));
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export async function createTask(input: CreateTaskInput, createdById: string): Promise<TaskResponseShape> {
  const project = await Project.findById(input.projectId);
  if (!project) throw new NotFoundError("Project");
  const created = await Task.create({
    projectId: new Types.ObjectId(input.projectId),
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? "MEDIUM",
    assigneeId: input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
    createdById: new Types.ObjectId(createdById),
    dueDate: input.dueDate ?? null,
  });
  const userNames = await buildUserNamesMap([created.assigneeId, created.createdById]);
  const projectInfo = new Map<string, { key: string; name: string }>([
    [project._id.toString(), { key: project.key, name: project.name }],
  ]);
  return denormalizeTask(created, { userNames, projectInfo });
}

export async function getTask(id: string): Promise<TaskResponseShape> {
  const t = await Task.findById(id);
  if (!t) throw new NotFoundError("Task");
  const userNames = await buildUserNamesMap([t.assigneeId, t.createdById]);
  const projectInfo = await buildProjectInfoMap([t.projectId]);
  return denormalizeTask(t, { userNames, projectInfo });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<TaskResponseShape> {
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
  const userNames = await buildUserNamesMap([t.assigneeId, t.createdById]);
  const projectInfo = await buildProjectInfoMap([t.projectId]);
  return denormalizeTask(t, { userNames, projectInfo });
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
  const userNames = await buildUserNamesMap([created.authorId]);
  return denormalizeComment(created, userNames);
}
