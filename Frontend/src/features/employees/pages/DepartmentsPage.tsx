import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { SearchBar } from "@/components/common/SearchBar";
import { RoleGate } from "@/features/auth/RoleGate";
import {
  useDepartmentsList,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useEmployeesList,
  type Department,
} from "../api/hooks";
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  type CreateDepartmentValues,
  type UpdateDepartmentValues,
} from "../schemas";

const NO_MANAGER = "__none__";

interface EditDialogProps {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditDepartmentDialog({ department, open, onOpenChange }: EditDialogProps) {
  const update = useUpdateDepartment(department.id);
  const employees = useEmployeesList({ limit: 100 });
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateDepartmentValues>({
    resolver: zodResolver(UpdateDepartmentSchema),
    defaultValues: {
      name: department.name,
      code: department.code,
      description: department.description ?? "",
      managerId: department.managerId ?? "",
    },
  });

  function onSubmit(values: UpdateDepartmentValues) {
    setError(null);
    update.mutate(
      {
        name: values.name,
        code: values.code,
        description: values.description?.trim() ? values.description.trim() : null,
        managerId: values.managerId && values.managerId.length > 0 ? values.managerId : null,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          if (axios.isAxiosError(err)) {
            setError((err.response?.data as { message?: string } | undefined)?.message ?? "Failed to update");
          } else {
            setError("Failed to update");
          }
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit department</DialogTitle>
          <DialogDescription>Update the team's name, code, manager or description.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (slug)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toLowerCase())}
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
                      placeholder="What does this team do?"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="managerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manager (optional)</FormLabel>
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : NO_MANAGER}
                    onValueChange={(v) => field.onChange(v === NO_MANAGER ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No manager" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                      {(employees.data?.items ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} <span className="text-muted-foreground">({u.email})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <div className="text-sm text-destructive" role="alert">{error}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeleteDepartmentDialog({ department, open, onOpenChange }: DeleteDialogProps) {
  const del = useDeleteDepartment();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    del.mutate(department.id, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          setError((err.response?.data as { message?: string } | undefined)?.message ?? "Failed to delete");
        } else {
          setError("Failed to delete");
        }
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setError(null);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete department</DialogTitle>
          <DialogDescription>
            Delete department: {department.name}? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {department.employeeCount > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            This department has {department.employeeCount}{" "}
            {department.employeeCount === 1 ? "member" : "members"}. Reassign them first or the
            server will reject the delete.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={del.isPending}
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DepartmentsPage() {
  const list = useDepartmentsList();
  const create = useCreateDepartment();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const form = useForm<CreateDepartmentValues>({
    resolver: zodResolver(CreateDepartmentSchema),
    defaultValues: { name: "", code: "" },
  });

  const filtered = useMemo(() => {
    const all = list.data?.items ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return all;
    return all.filter(
      (d) => d.name.toLowerCase().includes(t) || d.code.toLowerCase().includes(t),
    );
  }, [list.data?.items, search]);
  const paginated = usePagination(filtered, 10);

  function onCreate(values: CreateDepartmentValues) {
    setError(null);
    create.mutate(values, {
      onSuccess: () => form.reset({ name: "", code: "" }),
      onError: (err) => setError((err as Error).message ?? "Failed"),
    });
  }

  return (
    <PageContainer width="default" className="space-y-6">
      <PageHeader
        title="Departments"
        description="Org structure and team groupings."
      />
      <Card>
        <CardHeader><CardTitle>Create department</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCreate)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start"
              noValidate
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code (slug)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="eng"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:pt-7">
                <Button type="submit" disabled={create.isPending || form.formState.isSubmitting}>
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
              {error && (
                <div className="col-span-full text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Filter by name or code…"
            ariaLabel="Search departments"
          />
          {list.isLoading || !list.data ? (
            <Skeleton className="h-32 w-full" />
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              {search ? "No departments match your search." : "No departments yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Name</th>
                    <th>Code</th>
                    <th>Manager</th>
                    <th>Members</th>
                    <th className="w-px text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.items.map((d) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2">{d.name}</td>
                      <td>{d.code}</td>
                      <td>{d.managerName ?? "—"}</td>
                      <td>
                        <span className="font-mono">{d.employeeCount}</span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RoleGate roles={["HR", "ADMIN"]}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(d)}
                              aria-label={`Edit ${d.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          </RoleGate>
                          <RoleGate roles={["ADMIN"]}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleting(d)}
                              aria-label={`Delete ${d.name}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </RoleGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={paginated.page}
                pageSize={paginated.pageSize}
                totalPages={paginated.totalPages}
                totalItems={paginated.totalItems}
                onPageChange={paginated.setPage}
                onPageSizeChange={paginated.setPageSize}
                className="px-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditDepartmentDialog
          department={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteDepartmentDialog
          department={deleting}
          open={!!deleting}
          onOpenChange={(v) => !v && setDeleting(null)}
        />
      )}
    </PageContainer>
  );
}
