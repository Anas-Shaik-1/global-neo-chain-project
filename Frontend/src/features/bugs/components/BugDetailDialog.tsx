import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUpRight,
  Bug as BugIcon,
  Check,
  Copy,
  Image as ImageIcon,
  ListChecks,
  Pencil,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import {
  useCreateTaskFromBug,
  useUpdateBug,
  useUploadBugImage,
  type Bug,
  type BugStatus,
} from "../api/hooks";
import { EditBugSchema, type EditBugValues } from "../schemas";

interface Props {
  bug: Bug | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TONES: Record<BugStatus, "warn" | "info" | "success" | "default"> = {
  OPEN: "warn",
  IN_PROGRESS: "info",
  FIXED: "success",
  WONT_FIX: "default",
};

const STATUS_LABELS: Record<BugStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  FIXED: "Fixed",
  WONT_FIX: "Won't fix",
};

/**
 * Combined view + edit dialog for a single bug. Defaults to read-only view
 * mode for everyone; the "Edit" button only renders when the viewer is
 * either the bug's reporter (TESTER role) or an ADMIN — the same gate the
 * server applies on PATCH.
 */
export function BugDetailDialog({ bug, open, onOpenChange }: Props) {
  const me = useAppSelector((s) => s.auth.user);
  const [editing, setEditing] = useState(false);

  const update = useUpdateBug(bug?.id ?? "");
  const upload = useUploadBugImage(bug?.id ?? "");
  const promoteToTask = useCreateTaskFromBug(bug?.id ?? "");

  const form = useForm<EditBugValues>({
    resolver: zodResolver(EditBugSchema),
    defaultValues: {
      title: bug?.title ?? "",
      description: bug?.description ?? "",
      status: bug?.status ?? "OPEN",
    },
  });

  useEffect(() => {
    if (bug) {
      form.reset({
        title: bug.title,
        description: bug.description,
        status: bug.status,
      });
    }
    setEditing(false);
  }, [bug, form]);

  if (!bug) return null;

  // Edit is open to the bug's reporter (regardless of role) or any ADMIN.
  // Anyone can file; only the filer or an admin can change content/status.
  const canEdit =
    !!me && (me.id === bug.createdById || me.role === "ADMIN");

  async function onSubmit(values: EditBugValues) {
    try {
      await update.mutateAsync(values);
      setEditing(false);
    } catch {
      // toast handled in hook
    }
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
    } catch {
      // toast handled in hook
    }
  }

  function copyCode() {
    void navigator.clipboard.writeText(bug!.code);
  }

  // Branch command surfaced beneath the screenshot. Centralising the
  // string here keeps the chip + command copy buttons in lockstep (and
  // means future tweaks — e.g. switching to `git switch -c` — are a
  // single-line edit).
  const branchCommand = `git checkout -b fix/${bug.code}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BugIcon className="h-5 w-5 shrink-0 text-red-400" />
                <span className="truncate">{bug.title}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge tone={STATUS_TONES[bug.status]}>
                  {STATUS_LABELS[bug.status]}
                </StatusBadge>
                <button
                  type="button"
                  onClick={copyCode}
                  title="Copy bug code (use as branch name)"
                  className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/40 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {bug.code}
                </button>
                <span className="text-muted-foreground">
                  filed by {bug.createdByName ?? "Unknown"} ·{" "}
                  {new Date(bug.createdAt).toLocaleDateString()}
                </span>
              </DialogDescription>
            </div>
            {canEdit && !editing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {editing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
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
                control={form.control}
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
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="FIXED">Fixed</SelectItem>
                        <SelectItem value="WONT_FIX">Won't fix</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={6} maxLength={5000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={update.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border/60 bg-card/30 p-3 text-sm text-foreground">
              <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">
                {bug.description}
              </pre>
            </div>

            {/* ── Linked task strip ────────────────────────────────── */}
            {bug.linkedTaskId ? (
              <Link
                to="/tasks"
                className="group flex items-center gap-3 rounded-md border border-primary/30 bg-primary/[0.04] p-3 text-sm transition-colors hover:border-primary/60 hover:bg-primary/[0.08]"
              >
                <ListChecks className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    Linked task
                  </div>
                  <div className="truncate text-foreground/95">
                    {bug.linkedTaskTitle ?? "Open in Tasks"}
                  </div>
                </div>
                {bug.linkedTaskStatus && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]",
                      bug.linkedTaskStatus === "DONE"
                        ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300"
                        : bug.linkedTaskStatus === "IN_PROGRESS"
                          ? "border-sky-500/40 bg-sky-500/[0.08] text-sky-300"
                          : "border-amber-500/40 bg-amber-500/[0.08] text-amber-300",
                    )}
                  >
                    {bug.linkedTaskStatus.replace("_", " ").toLowerCase()}
                  </span>
                )}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ) : (
              canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border/60 bg-card/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    {bug.projectId
                      ? `Promote this bug to a task in ${bug.projectName ?? "its project"} so the engineering team can pick it up on the kanban.`
                      : "This bug isn't tied to a project — assign one in Edit before creating a task, or use the kanban directly."}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={!bug.projectId || promoteToTask.isPending}
                    onClick={() => promoteToTask.mutate({})}
                    title={
                      bug.projectId
                        ? `Create a task in ${bug.projectName ?? "this project"}`
                        : "Assign a project to this bug first"
                    }
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    {promoteToTask.isPending ? "Creating…" : "Create task"}
                  </Button>
                </div>
              )
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Screenshot
                </span>
                {canEdit && (
                  <label className="cursor-pointer text-xs text-primary hover:underline">
                    {bug.imageUrl ? "Replace" : "Attach"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
              {bug.imageUrl ? (
                <a
                  href={bug.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-border/60"
                  title="Open full-size in new tab"
                >
                  <img
                    src={bug.imageUrl}
                    alt={`${bug.title} screenshot`}
                    className="block max-h-80 w-full object-contain"
                  />
                </a>
              ) : (
                <div
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border border-dashed border-border/60 bg-card/30 px-3 py-6 text-xs text-muted-foreground",
                  )}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>No screenshot attached</span>
                </div>
              )}
            </div>

            {/* Branch hint — concrete copy-pasteable command using the
                auto-generated bug code. */}
            <div className="rounded-md border border-border/40 bg-card/30 p-3 font-mono text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{branchCommand}</span>
                <CopyIconButton
                  value={branchCommand}
                  ariaLabel="Copy git command"
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact icon-only copy button. Flips to a green check for ~1.4s after a
 * successful copy so the user gets clear visual feedback without a toast.
 * Reverts automatically — no manual reset needed.
 *
 * Falls back to a synchronous "select + execCommand" path on browsers /
 * insecure contexts that don't expose the async clipboard API. The icon
 * still flips to a check on success either way.
 */
function CopyIconButton({
  value,
  ariaLabel = "Copy",
  className,
}: {
  value: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function onClick() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Legacy fallback for non-HTTPS / older browsers.
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      // Silent failure is the right default here — the user can still
      // select-and-copy by hand if the clipboard API is locked down.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Copied" : ariaLabel}
      title={copied ? "Copied" : ariaLabel}
      className={
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/40 transition-colors " +
        (copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "text-muted-foreground hover:bg-accent hover:text-foreground") +
        (className ? " " + className : "")
      }
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}
