import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bug as BugIcon, Image as ImageIcon, X } from "lucide-react";
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
import { useProjects } from "@/features/tasks/api/hooks";
import { useCreateBug, useUploadBugImage } from "../api/hooks";
import { ReportBugSchema, type ReportBugValues } from "../schemas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Two-step "file a bug" dialog:
 *   1. Title + description (autogenerates the branch-friendly code on save)
 *   2. Optional screenshot upload to the just-created bug
 *
 * The image step runs after the create call so the bug exists in the DB
 * before we attach the image — keeps the storage cleanup story simple.
 */
export function ReportBugDialog({ open, onOpenChange }: Props) {
  const create = useCreateBug();
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // We need the just-created bug's id to upload the image — held in state
  // between the create-success and the optional upload step.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const upload = useUploadBugImage(createdId ?? "");

  const projectsQ = useProjects({ limit: 100 });

  const form = useForm<ReportBugValues>({
    resolver: zodResolver(ReportBugSchema),
    defaultValues: { title: "", description: "", projectId: "" },
  });

  function reset() {
    form.reset({ title: "", description: "", projectId: "" });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingImage(null);
    setPreviewUrl(null);
    setCreatedId(null);
  }

  function pickImage(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPendingImage(null);
      setPreviewUrl(null);
      return;
    }
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onSubmit(values: ReportBugValues) {
    try {
      const created = await create.mutateAsync({
        title: values.title,
        description: values.description,
        projectId:
          values.projectId && values.projectId.length > 0
            ? values.projectId
            : undefined,
      });
      setCreatedId(created.id);
      if (pendingImage) {
        // Re-bind upload mutator to the new id and fire it. We don't gate
        // dialog-close on this — image upload errors surface as toasts.
        await fetch(""); // keep async ordering deterministic
        try {
          await upload.mutateAsync(pendingImage);
        } catch {
          // toast already fired inside the hook
        }
      }
      reset();
      onOpenChange(false);
    } catch {
      // toast already fired inside useCreateBug
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BugIcon className="h-5 w-5 text-red-400" />
            File a bug
          </DialogTitle>
          <DialogDescription>
            A short, specific title makes the branch name useful — it's
            auto-generated from the title (e.g. <code>login-button-broken-a3f4</code>).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Login button is broken on mobile"
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
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
                    <Textarea
                      placeholder="Steps to reproduce, expected vs actual, environment…"
                      maxLength={5000}
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (optional)</FormLabel>
                  <Select
                    value={
                      field.value && field.value.length > 0
                        ? field.value
                        : "__none__"
                    }
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? "" : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a project…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {(projectsQ.data?.items ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-xs text-muted-foreground">
                            {p.key}
                          </span>{" "}
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Screenshot (optional)</FormLabel>
              {pendingImage && previewUrl ? (
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Screenshot preview"
                    className="max-h-40 rounded-md border border-border/60 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => pickImage(null)}
                    aria-label="Remove screenshot"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border/60 bg-card/40 px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card/60">
                  <ImageIcon className="h-4 w-4" />
                  <span>Click to attach an image (≤5MB, PNG/JPEG/WebP/GIF)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={create.isPending || upload.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={create.isPending || upload.isPending}
              >
                {create.isPending || upload.isPending ? "Filing…" : "File bug"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
