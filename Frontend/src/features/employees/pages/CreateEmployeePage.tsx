import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateEmployee, useDepartmentsList } from "../api/hooks";

export function CreateEmployeePage() {
  const navigate = useNavigate();
  const create = useCreateEmployee();
  const depts = useDepartmentsList();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "HR" | "PM" | "ADMIN">("EMPLOYEE");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate(
      { email, name, role, jobTitle: jobTitle || undefined, departmentId: departmentId || undefined },
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
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as never)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="PM">Project Manager</option>
                <option value="HR">HR</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <select
                id="departmentId"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {depts.data?.items.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create employee"}
            </Button>
            <p className="text-sm text-muted-foreground">
              The temp password is logged on the backend (`info` level). Email invites are coming with sub-project #2.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
