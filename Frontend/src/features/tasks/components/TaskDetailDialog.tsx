import { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeesList } from "@/features/employees/api/hooks";
import {
  useUpdateTask,
  useComments,
  useAddComment,
  useTaskActivity,
  useSubtasks,
  useCreateTask,
  type Task,
  type TaskActivity,
  type TaskActivityKind,
  type TaskPriority,
  type TaskStatus,
} from "../api/hooks";

function dateToInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ACTIVITY_ICON: Record<TaskActivityKind, string> = {
  CREATED: "+",
  STATUS_CHANGED: "→",
  ASSIGNED: "@",
  PRIORITY_CHANGED: "!",
  DUE_DATE_CHANGED: "📅",
  TITLE_CHANGED: "✎",
  COMMENTED: "💬",
};

function activityLabel(a: TaskActivity): string {
  switch (a.kind) {
    case "CREATED":
      return "created the task";
    case "STATUS_CHANGED":
      return `changed status from ${a.fromValue ?? "?"} to ${a.toValue ?? "?"}`;
    case "ASSIGNED":
      return `re-assigned from ${a.fromValue ?? "unassigned"} to ${a.toValue ?? "unassigned"}`;
    case "PRIORITY_CHANGED":
      return `changed priority from ${a.fromValue ?? "?"} to ${a.toValue ?? "?"}`;
    case "DUE_DATE_CHANGED":
      return `changed due date from ${a.fromValue ?? "—"} to ${a.toValue ?? "—"}`;
    case "TITLE_CHANGED":
      return `renamed from "${a.fromValue ?? ""}" to "${a.toValue ?? ""}"`;
    case "COMMENTED":
      return `commented: ${a.summary ?? ""}`;
    default:
      return a.summary ?? "";
  }
}

function statusLabel(s: TaskStatus): string {
  if (s === "TODO") return "To do";
  if (s === "IN_PROGRESS") return "In progress";
  return "Done";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}

export function TaskDetailDialog({ open, onOpenChange, task }: Props) {
  const update = useUpdateTask(task?.id ?? "");
  const comments = useComments(task?.id);
  const addComment = useAddComment(task?.id ?? "");
  const employees = useEmployeesList({ limit: 100 });
  const activity = useTaskActivity(task?.id);
  const subtasks = useSubtasks(task?.id);
  const createSubtask = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId ?? "");
    setDueDate(dateToInput(task.dueDate));
    setError(null);
    setNewComment("");
    setCommentError(null);
    setNewSubtaskTitle("");
    setSubtaskError(null);
  }, [task]);

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    setError(null);
    update.mutate(
      {
        title,
        description: description || null,
        status,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      },
      {
        onError: (err) => setError((err as Error).message ?? "Failed to save"),
      },
    );
  }

  function onAddComment(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    if (!newComment.trim()) return;
    setCommentError(null);
    addComment.mutate(newComment, {
      onSuccess: () => setNewComment(""),
      onError: (err) => setCommentError((err as Error).message ?? "Failed to add comment"),
    });
  }

  function onAddSubtask(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    if (!newSubtaskTitle.trim()) return;
    setSubtaskError(null);
    createSubtask.mutate(
      {
        projectId: task.projectId,
        title: newSubtaskTitle.trim(),
        parentTaskId: task.id,
      },
      {
        onSuccess: () => setNewSubtaskTitle(""),
        onError: (err) => setSubtaskError((err as Error).message ?? "Failed to add subtask"),
      },
    );
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="text-xs font-mono uppercase text-muted-foreground">
              {task.projectKey}
            </span>{" "}
            <span className="ml-2">{task.title}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="comments" className="flex-1">
              Comments
              {comments.data && comments.data.length > 0 && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {comments.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="subtasks" className="flex-1">
              Subtasks
              {subtasks.data && subtasks.data.length > 0 && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {subtasks.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="td-title">Title</Label>
                <Input
                  id="td-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="td-desc">Description</Label>
                <textarea
                  id="td-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="td-status">Status</Label>
                  <select
                    id="td-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="TODO">To do</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="td-priority">Priority</Label>
                  <select
                    id="td-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="td-assignee">Assignee</Label>
                  <select
                    id="td-assignee"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {employees.data?.items.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="td-due">Due date</Label>
                  <Input
                    id="td-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              {error && (
                <div role="alert" className="text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Created by {task.createdByName ?? "—"}
                </div>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            {comments.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : comments.data && comments.data.length > 0 ? (
              <ul className="space-y-3">
                {comments.data.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(c.authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {c.authorName ?? "Unknown"}
                        </span>{" "}
                        · {formatTimestamp(c.createdAt)}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm">{c.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No comments yet.</div>
            )}

            <form onSubmit={onAddComment} className="mt-4 space-y-2">
              <Label htmlFor="td-new-comment">Add a comment</Label>
              <textarea
                id="td-new-comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={2000}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              {commentError && (
                <div role="alert" className="text-sm text-destructive">
                  {commentError}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={addComment.isPending || !newComment.trim()}
                >
                  {addComment.isPending ? "Posting..." : "Post comment"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="subtasks" className="mt-4">
            {subtasks.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : subtasks.data && subtasks.data.length > 0 ? (
              <ul className="space-y-2">
                {subtasks.data.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="text-sm font-medium">{s.title}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {statusLabel(s.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No subtasks yet.</div>
            )}
            <form onSubmit={onAddSubtask} className="mt-4 flex gap-2">
              <Input
                aria-label="New subtask title"
                placeholder="Subtask title"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                maxLength={200}
              />
              <Button
                type="submit"
                size="sm"
                disabled={createSubtask.isPending || !newSubtaskTitle.trim()}
              >
                {createSubtask.isPending ? "Adding..." : "Add subtask"}
              </Button>
            </form>
            {subtaskError && (
              <div role="alert" className="mt-2 text-sm text-destructive">
                {subtaskError}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {activity.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : activity.data && activity.data.length > 0 ? (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {activity.data.map((a) => (
                  <li key={a.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[26px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-[10px]"
                    >
                      {ACTIVITY_ICON[a.kind] ?? "•"}
                    </span>
                    <div className="text-sm">
                      <span className="font-medium">{a.actorName ?? "Unknown"}</span>{" "}
                      <span className="text-muted-foreground">{activityLabel(a)}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {relativeTime(a.createdAt)}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
