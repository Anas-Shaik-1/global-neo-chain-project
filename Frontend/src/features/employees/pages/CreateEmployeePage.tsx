import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useCreateEmployee, useDepartmentsList } from "../api/hooks";
import { CreateEmployeeSchema, type CreateEmployeeValues } from "../schemas";

const NO_DEPARTMENT_VALUE = "__none__";

export function CreateEmployeePage() {
  const navigate = useNavigate();
  const create = useCreateEmployee();
  const depts = useDepartmentsList();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateEmployeeValues>({
    resolver: zodResolver(CreateEmployeeSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "EMPLOYEE",
      jobTitle: "",
      departmentId: "",
    },
  });

  function onSubmit(values: CreateEmployeeValues) {
    setError(null);
    create.mutate(
      {
        email: values.email,
        name: values.name,
        role: values.role,
        jobTitle: values.jobTitle ? values.jobTitle : undefined,
        departmentId: values.departmentId ? values.departmentId : undefined,
      },
      {
        onSuccess: (created) => navigate(`/people/${created.id}`),
        onError: (err) => setError((err as Error).message ?? "Failed"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>New employee</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      value={field.value ? field.value : NO_DEPARTMENT_VALUE}
                      onValueChange={(v) =>
                        field.onChange(v === NO_DEPARTMENT_VALUE ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="— None —" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT_VALUE}>— None —</SelectItem>
                        {depts.data?.items.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
              <Button type="submit" disabled={create.isPending || form.formState.isSubmitting}>
                {create.isPending ? "Creating…" : "Create employee"}
              </Button>
              <p className="text-sm text-muted-foreground">
                The temp password is logged on the backend (`info` level). Email invites are coming with sub-project #2.
              </p>
              <p className="text-sm text-muted-foreground">
                To grant Project Manager rights, create the user as Employee then promote
                them from their detail page.
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
