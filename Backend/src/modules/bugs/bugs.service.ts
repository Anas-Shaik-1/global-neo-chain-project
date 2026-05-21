import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { Bug, type BugStatus } from "../../models/bug.model.js";
import { Project } from "../../models/project.model.js";
import { Task, type TaskStatus, type TaskPriority } from "../../models/task.model.js";
import { User, type Role } from "../../models/user.model.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { createFileStorage } from "../../lib/storage.js";
import { createTask } from "../tasks/tasks.service.js";

const storage = createFileStorage();

interface PublicBug {
  id: string;
  title: string;
  code: string;
  description: string;
  imageUrl: string | null;
  status: BugStatus;
  createdById: string;
  createdByName: string | null;
  projectId: string | null;
  projectName: string | null;
  projectKey: string | null;
  /** Linked Task (created via "Create task" on a bug). */
  linkedTaskId: string | null;
  linkedTaskTitle: string | null;
  linkedTaskStatus: TaskStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BugDocLike {
  _id: Types.ObjectId;
  title: string;
  code: string;
  description: string;
  imageUrl: string | null;
  status: BugStatus;
  createdById: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  linkedTaskId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectInfo {
  name: string;
  key: string;
}

interface LinkedTaskInfo {
  id: string;
  title: string;
  status: TaskStatus;
}

function toPublic(
  bug: BugDocLike,
  name: string | null,
  project: ProjectInfo | null = null,
  linkedTask: LinkedTaskInfo | null = null,
): PublicBug {
  return {
    id: bug._id.toString(),
    title: bug.title,
    code: bug.code,
    description: bug.description,
    imageUrl: bug.imageUrl,
    status: bug.status,
    createdById: bug.createdById.toString(),
    createdByName: name,
    projectId: bug.projectId ? bug.projectId.toString() : null,
    projectName: project?.name ?? null,
    projectKey: project?.key ?? null,
    linkedTaskId: linkedTask?.id ?? (bug.linkedTaskId?.toString() ?? null),
    linkedTaskTitle: linkedTask?.title ?? null,
    linkedTaskStatus: linkedTask?.status ?? null,
    createdAt: bug.createdAt,
    updatedAt: bug.updatedAt,
  };
}

async function loadLinkedTask(
  taskId: Types.ObjectId | null | undefined,
): Promise<LinkedTaskInfo | null> {
  if (!taskId) return null;
  const t = await Task.findById(taskId)
    .select("_id title status")
    .lean<{ _id: Types.ObjectId; title: string; status: TaskStatus } | null>();
  if (!t) return null;
  return { id: t._id.toString(), title: t.title, status: t.status };
}

/**
 * Generate a branch-friendly slug from a bug title plus a 3-byte random
 * suffix for uniqueness, e.g. `login-button-broken-a3f4e1`. The result is
 * lowercase ASCII alphanumerics + hyphens only — safe to drop into a git
 * branch name verbatim (`git checkout -b fix/<code>`).
 */
function generateBugCode(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const suffix = randomBytes(3).toString("hex");
  return slug ? `${slug}-${suffix}` : `bug-${suffix}`;
}

interface ListInput {
  page?: number;
  limit?: number;
  status?: BugStatus;
  projectId?: string;
}

export async function listBugs(input: ListInput = {}) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const page = Math.max(1, input.page ?? 1);
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.projectId) filter.projectId = new Types.ObjectId(input.projectId);

  const [docs, total] = await Promise.all([
    Bug.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<BugDocLike[]>(),
    Bug.countDocuments(filter),
  ]);

  // Batch-fetch reporter names + project labels referenced on this page so
  // we avoid N+1 lookups when rendering the list.
  const reporterIds = Array.from(
    new Set(docs.map((d) => d.createdById.toString())),
  );
  const reporters = await User.find({
    _id: { $in: reporterIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("name")
    .lean<{ _id: Types.ObjectId; name: string }[]>();
  const nameById = new Map(reporters.map((r) => [r._id.toString(), r.name]));

  const projectIds = Array.from(
    new Set(
      docs
        .map((d) => d.projectId?.toString())
        .filter((s): s is string => !!s),
    ),
  );
  const projectsById = new Map<string, ProjectInfo>();
  if (projectIds.length > 0) {
    const projects = await Project.find({
      _id: { $in: projectIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("name key")
      .lean<{ _id: Types.ObjectId; name: string; key: string }[]>();
    for (const p of projects) {
      projectsById.set(p._id.toString(), { name: p.name, key: p.key });
    }
  }

  // Batch-fetch linked task info for the page so we can render the
  // linked-task chip without an N+1 round trip.
  const linkedTaskIds = Array.from(
    new Set(
      docs.map((d) => d.linkedTaskId?.toString()).filter((s): s is string => !!s),
    ),
  );
  const tasksById = new Map<string, LinkedTaskInfo>();
  if (linkedTaskIds.length > 0) {
    const tasks = await Task.find({
      _id: { $in: linkedTaskIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id title status")
      .lean<{ _id: Types.ObjectId; title: string; status: TaskStatus }[]>();
    for (const t of tasks) {
      tasksById.set(t._id.toString(), {
        id: t._id.toString(),
        title: t.title,
        status: t.status,
      });
    }
  }

  return {
    items: docs.map((b) => {
      const project = b.projectId
        ? projectsById.get(b.projectId.toString()) ?? null
        : null;
      const linkedTask = b.linkedTaskId
        ? tasksById.get(b.linkedTaskId.toString()) ?? null
        : null;
      return toPublic(
        b,
        nameById.get(b.createdById.toString()) ?? null,
        project,
        linkedTask,
      );
    }),
    total,
    page,
    limit,
  };
}

async function loadProjectInfo(
  projectId: Types.ObjectId | null | undefined,
): Promise<ProjectInfo | null> {
  if (!projectId) return null;
  const p = await Project.findById(projectId).select("name key").lean<
    { name: string; key: string } | null
  >();
  return p ? { name: p.name, key: p.key } : null;
}

async function ensureProjectExists(projectId: string): Promise<Types.ObjectId> {
  if (!Types.ObjectId.isValid(projectId)) throw new NotFoundError("Project");
  const p = await Project.findById(projectId).select("_id").lean();
  if (!p) throw new NotFoundError("Project");
  return new Types.ObjectId(projectId);
}

export async function getBug(id: string): Promise<PublicBug> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Bug");
  const doc = await Bug.findById(id).lean<BugDocLike | null>();
  if (!doc) throw new NotFoundError("Bug");
  const reporter = await User.findById(doc.createdById).select("name").lean<{ name: string } | null>();
  const project = await loadProjectInfo(doc.projectId);
  const linkedTask = await loadLinkedTask(doc.linkedTaskId);
  return toPublic(doc, reporter?.name ?? null, project, linkedTask);
}

interface CreateInput {
  title: string;
  description: string;
  projectId?: string;
}

/**
 * Any authenticated user may file a bug — anyone working on a project should
 * be able to flag a regression they found, not just QA. Auto-generates a
 * unique branch-friendly `code` from the title (with a tiny retry loop on
 * the rare suffix collision).
 */
export async function createBug(
  reporter: { id: string; role: Role },
  input: CreateInput,
): Promise<PublicBug> {
  const projectObjectId = input.projectId
    ? await ensureProjectExists(input.projectId)
    : null;

  // Tiny retry loop in case the random suffix collides (~1-in-16M; extremely
  // unlikely but cheap to defend against).
  let attempt = 0;
  while (attempt < 5) {
    const code = generateBugCode(input.title);
    try {
      const created = await Bug.create({
        title: input.title.trim(),
        code,
        description: input.description.trim(),
        createdById: new Types.ObjectId(reporter.id),
        projectId: projectObjectId,
      });
      const doc = created.toObject() as unknown as BugDocLike;
      const userName = await User.findById(reporter.id).select("name").lean<{ name: string } | null>();
      const project = await loadProjectInfo(projectObjectId);
      logger.info(
        {
          bugId: doc._id.toString(),
          code,
          reporterId: reporter.id,
          projectId: projectObjectId?.toString(),
        },
        "bug filed",
      );
      return toPublic(doc, userName?.name ?? null, project);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to allocate a unique bug code after multiple attempts");
}

interface UpdateInput {
  title?: string;
  description?: string;
  status?: BugStatus;
  /** `null` clears the project assignment; an id (re-)assigns. Undefined leaves it. */
  projectId?: string | null;
}

/**
 * Edits are limited to the user who filed the bug or any ADMIN. Other
 * teammates are read-only here so accidental cross-team edits don't happen.
 */
export async function updateBug(
  id: string,
  editor: { id: string; role: Role },
  input: UpdateInput,
): Promise<PublicBug> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Bug");
  const bug = await Bug.findById(id);
  if (!bug) throw new NotFoundError("Bug");

  const isOwner = bug.createdById.toString() === editor.id;
  const isAdmin = editor.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only the bug's reporter or an Admin can edit it");
  }

  const previousStatus = bug.status;
  if (typeof input.title === "string") bug.title = input.title.trim();
  if (typeof input.description === "string") bug.description = input.description.trim();
  if (input.status) bug.status = input.status;
  if (input.projectId !== undefined) {
    bug.projectId =
      input.projectId === null ? null : await ensureProjectExists(input.projectId);
  }
  await bug.save();

  const reporter = await User.findById(bug.createdById).select("name").lean<{ name: string } | null>();
  const project = await loadProjectInfo(bug.projectId);

  // Notify the bug reporter when their bug transitions to a closed state
  // (FIXED or WONT_FIX). Only fire when the editor is not the reporter
  // themselves (e.g., admin closes the ticket) to avoid self-noise.
  const closingTransition =
    input.status &&
    input.status !== previousStatus &&
    (input.status === "FIXED" || input.status === "WONT_FIX");
  const reporterId = bug.createdById.toString();
  if (closingTransition && reporterId !== editor.id) {
    void (async () => {
      const { notify } = await import(
        "../notifications/notifications.service.js"
      );
      await notify(reporterId, {
        kind: "BUG_RESOLVED",
        title:
          bug.status === "FIXED"
            ? `Bug fixed: ${bug.title}`
            : `Bug closed (won't fix): ${bug.title}`,
        body: `Bug ${bug.code}`,
        link: "/bugs",
      });
    })().catch((err) => logger.warn({ err, id }, "bugs.updateBug notify failed"));
  }

  const linkedTask = await loadLinkedTask(bug.linkedTaskId ?? null);
  return toPublic(
    bug.toObject() as unknown as BugDocLike,
    reporter?.name ?? null,
    project,
    linkedTask,
  );
}

/**
 * Replace the bug's image. Same edit-permission gate as updateBug. Old
 * image (if any) is deleted from storage to avoid orphans.
 */
export async function setBugImage(
  id: string,
  editor: { id: string; role: Role },
  file: { originalName: string; mimeType: string; buffer: Buffer },
): Promise<PublicBug> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Bug");
  const bug = await Bug.findById(id);
  if (!bug) throw new NotFoundError("Bug");

  const isOwner = bug.createdById.toString() === editor.id;
  const isAdmin = editor.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only the bug's reporter or an Admin can edit it");
  }

  // Best-effort cleanup of the previous image before swapping. The URL we
  // stored is the public path; the storage `delete` takes the relative key
  // — we strip the public-base prefix to recover it.
  if (bug.imageUrl) {
    const idx = bug.imageUrl.indexOf("/files/");
    if (idx >= 0) {
      const oldKey = bug.imageUrl.slice(idx + "/files/".length);
      try {
        await storage.delete(oldKey);
      } catch (err) {
        logger.warn({ err, oldKey }, "failed to delete previous bug image");
      }
    }
  }

  const saved = await storage.save("bug", editor.id, file);
  bug.imageUrl = saved.url;
  await bug.save();

  const reporter = await User.findById(bug.createdById).select("name").lean<{ name: string } | null>();
  const project = await loadProjectInfo(bug.projectId);
  const linkedTask = await loadLinkedTask(bug.linkedTaskId ?? null);
  return toPublic(
    bug.toObject() as unknown as BugDocLike,
    reporter?.name ?? null,
    project,
    linkedTask,
  );
}

// ─── bug → task linkage ──────────────────────────────────────────────────

interface CreateTaskFromBugInput {
  /** Project to file the task into. Falls back to the bug's projectId
   *  if the bug already has one assigned and no override is sent. */
  projectId?: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
}

/**
 * Promote a bug to a task. Creates a Task whose title and description
 * include the bug's code so the link is visible in any task view, then
 * stamps `linkedTaskId` on the bug and `linkedBugId` on the task. The
 * task lifecycle is independent of the bug — closing one doesn't
 * automatically close the other (intentional; QA owns bug status, devs
 * own task status).
 *
 * Edit gate matches `updateBug`: only the bug's reporter or an Admin
 * may convert. Anyone else gets 403.
 */
export async function createTaskFromBug(
  bugId: string,
  editor: { id: string; role: Role },
  input: CreateTaskFromBugInput,
): Promise<PublicBug> {
  if (!Types.ObjectId.isValid(bugId)) throw new NotFoundError("Bug");
  const bug = await Bug.findById(bugId);
  if (!bug) throw new NotFoundError("Bug");

  const isOwner = bug.createdById.toString() === editor.id;
  const isAdmin = editor.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only the bug's reporter or an Admin can create a task from it");
  }

  if (bug.linkedTaskId) {
    throw new ValidationError(
      "This bug is already linked to a task. Update the task directly instead.",
    );
  }

  // Project resolution: explicit input wins, else fall back to the
  // bug's project. If neither is set we can't file a task — Tasks
  // belong to projects.
  const targetProjectId =
    input.projectId ?? bug.projectId?.toString() ?? null;
  if (!targetProjectId) {
    throw new ValidationError(
      "Choose a project for the task — this bug isn't tied to one.",
    );
  }

  // Use the existing tasks service so we share its validation, project
  // lookup, due-date guard and activity logging. The bug code lands in
  // the title for visibility on the kanban board.
  const taskTitle = `[BUG-${bug.code}] ${bug.title}`.slice(0, 200);
  const taskDescription = [
    `Linked from bug \`${bug.code}\`.`,
    "",
    bug.description,
  ].join("\n");
  const task = await createTask(
    {
      projectId: targetProjectId,
      title: taskTitle,
      description: taskDescription,
      priority: input.priority,
      assigneeId: input.assigneeId ?? undefined,
    },
    editor.id,
  );

  // Stamp both sides of the link. We update the Task directly because
  // the tasks service create path doesn't expose linkedBugId yet —
  // the field is metadata only and doesn't affect any downstream flow.
  bug.linkedTaskId = new Types.ObjectId(task.id);
  // If the bug is still OPEN, advance it to IN_PROGRESS — picking it
  // up as a task IS work-in-progress. WONT_FIX / FIXED stay put.
  if (bug.status === "OPEN") bug.status = "IN_PROGRESS";
  await bug.save();
  await Task.findByIdAndUpdate(task.id, {
    linkedBugId: bug._id,
  });

  logger.info(
    {
      bugId: bug._id.toString(),
      bugCode: bug.code,
      taskId: task.id,
      projectId: targetProjectId,
      editorId: editor.id,
    },
    "bug linked to task",
  );

  const reporter = await User.findById(bug.createdById)
    .select("name")
    .lean<{ name: string } | null>();
  const project = await loadProjectInfo(bug.projectId);
  const linkedTask = await loadLinkedTask(bug.linkedTaskId);
  return toPublic(
    bug.toObject() as unknown as BugDocLike,
    reporter?.name ?? null,
    project,
    linkedTask,
  );
}
