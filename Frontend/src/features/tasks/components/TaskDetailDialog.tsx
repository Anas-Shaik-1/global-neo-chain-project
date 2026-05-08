import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type TaskStatus,
} from "../api/hooks";
import {
  AddCommentSchema,
  AddSubtaskSchema,
  UpdateTaskSchema,
  type AddCommentValues,
  type AddSubtaskValues,
  type UpdateTaskValues,
} from "../schemas";

const UNASSIGNED_VALUE = "__unassigned__";

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

  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);

  const detailsForm = useForm<UpdateTaskValues>({
    resolver: zodResolver(UpdateTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: "",
      dueDate: "",
    },
  });

  const commentForm = useForm<AddCommentValues>({
    resolver: zodResolver(AddCommentSchema),
    defaultValues: { body: "" },
  });

  const subtaskForm = useForm<AddSubtaskValues>({
    resolver: zodResolver(AddSubtaskSchema),
    defaultValues: { title: "", assigneeId: "" },
  });

  // Only reset on identity change of the task being viewed — refetches that
  // return the same task id (e.g. background revalidations after a comment
  // is posted) shouldn't wipe in-progress edits to the details form.
  useEffect(() => {
    if (!task) return;
    detailsForm.reset({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId ?? "",
      dueDate: dateToInput(task.dueDate),
    });
    setError(null);
    commentForm.reset({ body: "" });
    setCommentError(null);
    subtaskForm.reset({ title: "", assigneeId: "" });
    setSubtaskError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  function onSave(values: UpdateTaskValues) {
    if (!task) return;
    setError(null);
    update.mutate(
      {
        title: values.title,
        description: values.description ? values.description : null,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId ? values.assigneeId : null,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      },
      {
        onError: (err) => setError((err as Error).message ?? "Failed to save"),
      },
    );
  }

  function onAddComment(values: AddCommentValues) {
    if (!task) return;
    setCommentError(null);
    addComment.mutate(values.body, {
      onSuccess: () => commentForm.reset({ body: "" }),
      onError: (err) => setCommentError((err as Error).message ?? "Failed to add comment"),
    });
  }

  function onAddSubtask(values: AddSubtaskValues) {
    if (!task) return;
    setSubtaskError(null);
    createSubtask.mutate(
      {
        projectId: task.projectId,
        title: values.title.trim(),
        parentTaskId: task.id,
        assigneeId:
          values.assigneeId && values.assigneeId.length > 0
            ? values.assigneeId
            : null,
      },
      {
        onSuccess: () => subtaskForm.reset({ title: "", assigneeId: "" }),
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
            <Form {...detailsForm}>
              <form
                onSubmit={detailsForm.handleSubmit(onSave)}
                className="space-y-4"
                noValidate
              >
                <FormField
                  control={detailsForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input maxLength={200} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={detailsForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[100px]"
                          maxLength={5000}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={detailsForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TODO">To do</SelectItem>
                            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="ENHANCEMENT">Enhancement</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <Select
                          value={field.value ? field.value : UNASSIGNED_VALUE}
                          onValueChange={(v) =>
                            field.onChange(v === UNASSIGNED_VALUE ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                            {employees.data?.items.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <Button
                    type="submit"
                    disabled={update.isPending || detailsForm.formState.isSubmitting}
                  >
                    {update.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            </Form>
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

            <Form {...commentForm}>
              <form
                onSubmit={commentForm.handleSubmit(onAddComment)}
                className="mt-4 space-y-2"
                noValidate
              >
                <FormField
                  control={commentForm.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Add a comment</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[60px]"
                          maxLength={2000}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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
                    disabled={addComment.isPending || commentForm.formState.isSubmitting}
                  >
                    {addComment.isPending ? "Posting..." : "Post comment"}
                  </Button>
                </div>
              </form>
            </Form>
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
            <Form {...subtaskForm}>
              <form
                onSubmit={subtaskForm.handleSubmit(onAddSubtask)}
                className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start"
                noValidate
              >
                <FormField
                  control={subtaskForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          aria-label="New subtask title"
                          placeholder="Subtask title"
                          maxLength={200}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={subtaskForm.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem className="sm:w-48">
                      <Select
                        // Empty-string sentinel is invalid for Radix Select;
                        // wrap to "__none__" so "Unassigned" renders cleanly.
                        value={field.value && field.value.length > 0 ? field.value : "__none__"}
                        onValueChange={(v) =>
                          field.onChange(v === "__none__" ? "" : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Assign to">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {(employees.data?.items ?? []).map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={createSubtask.isPending || subtaskForm.formState.isSubmitting}
                >
                  {createSubtask.isPending ? "Adding..." : "Add subtask"}
                </Button>
              </form>
            </Form>
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
