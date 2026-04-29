import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { PageHeader } from "@/components/common/PageHeader";
import { useDepartmentsList, useCreateDepartment } from "../api/hooks";
import { CreateDepartmentSchema, type CreateDepartmentValues } from "../schemas";

export function DepartmentsPage() {
  const list = useDepartmentsList();
  const create = useCreateDepartment();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateDepartmentValues>({
    resolver: zodResolver(CreateDepartmentSchema),
    defaultValues: { name: "", code: "" },
  });

  function onCreate(values: CreateDepartmentValues) {
    setError(null);
    create.mutate(values, {
      onSuccess: () => form.reset({ name: "", code: "" }),
      onError: (err) => setError((err as Error).message ?? "Failed"),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
        <CardContent>
          {list.isLoading || !list.data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th>Code</th>
                  <th>Manager</th>
                  <th>Employees</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2">{d.name}</td>
                    <td>{d.code}</td>
                    <td>{d.managerName ?? "—"}</td>
                    <td>{d.employeeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
