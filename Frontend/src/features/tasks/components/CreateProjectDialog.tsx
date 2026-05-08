import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useCreateProject, type Project } from "../api/hooks";
import { CreateProjectSchema, type CreateProjectValues } from "../schemas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}

/**
 * Slug rules from the backend: lowercase alphanumeric + hyphens, max 30 chars.
 * Mirrors the regex in `Backend/src/models/project.model.ts`.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const create = useCreateProject();
  const [error, setError] = useState<string | null>(null);
  // The slug auto-fills from the name until the user manually edits it.
  // Once they touch it, we stop overwriting on subsequent name changes.
  const slugTouchedRef = useRef(false);

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: { name: "", key: "", description: "" },
  });

  // Watch the name and mirror its slug into the key field until the user
  // hand-edits the slug.
  const watchedName = form.watch("name");
  useEffect(() => {
    if (slugTouchedRef.current) return;
    form.setValue("key", slugify(watchedName ?? ""), { shouldValidate: false });
  }, [watchedName, form]);

  function reset() {
    form.reset({ name: "", key: "", description: "" });
    slugTouchedRef.current = false;
    setError(null);
  }

  function onSubmit(values: CreateProjectValues) {
    setError(null);
    create.mutate(
      {
        name: values.name,
        key: values.key,
        description: values.description ? values.description : undefined,
      },
      {
        onSuccess: (created) => {
          reset();
          onOpenChange(false);
          onCreated?.(created);
        },
        onError: (err) => setError((err as Error).message ?? "Failed to create project"),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Atlas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key (slug)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="atlas"
                      {...field}
                      onChange={(e) => {
                        // Once the user types in the slug field, stop
                        // auto-generating from the name. Sanitize input to
                        // match the backend regex on the way in.
                        slugTouchedRef.current = true;
                        field.onChange(slugify(e.target.value));
                      }}
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea maxLength={500} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <div role="alert" className="text-sm text-destructive">
                {error}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || form.formState.isSubmitting}>
                {create.isPending ? "Creating..." : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
