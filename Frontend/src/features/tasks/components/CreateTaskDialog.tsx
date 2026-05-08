import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployeesList } from "@/features/employees/api/hooks";
import { useCreateTask, type TaskStatus, type Task } from "../api/hooks";
import { CreateTaskSchema, type CreateTaskValues } from "../schemas";

const UNASSIGNED_VALUE = "__unassigned__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialStatus?: TaskStatus;
  onCreated?: (task: Task) => void;
}

export function CreateTaskDialog({ open, onOpenChange, projectId, onCreated }: Props) {
  const create = useCreateTask();
  const employees = useEmployeesList({ limit: 100 });
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      assigneeId: "",
      dueDate: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        title: "",
        description: "",
        priority: "MEDIUM",
        assigneeId: "",
        dueDate: "",
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(values: CreateTaskValues) {
    setError(null);
    create.mutate(
      {
        projectId,
        title: values.title,
        description: values.description ? values.description : undefined,
        priority: values.priority,
        assigneeId: values.assigneeId ? values.assigneeId : null,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      },
      {
        onSuccess: (created) => {
          onOpenChange(false);
          onCreated?.(created);
        },
        onError: (err) => setError((err as Error).message ?? "Failed to create task"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
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
                    <Input maxLength={200} {...field} />
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
                    <Textarea maxLength={5000} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
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
                control={form.control}
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
            </div>
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      // Forward-only: tasks can't be filed already overdue.
                      // Backend re-validates the same rule, this is just UX.
                      min={new Date().toISOString().slice(0, 10)}
                      {...field}
                      value={field.value ?? ""}
                    />
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
                {create.isPending ? "Creating..." : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
