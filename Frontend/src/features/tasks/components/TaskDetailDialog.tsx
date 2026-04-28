import { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  type Task,
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

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

        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-3 text-sm font-semibold">Comments</div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
