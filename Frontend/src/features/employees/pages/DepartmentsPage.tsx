import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { useDepartmentsList, useCreateDepartment } from "../api/hooks";

export function DepartmentsPage() {
  const list = useDepartmentsList();
  const create = useCreateDepartment();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate(
      { name, code },
      {
        onSuccess: () => { setName(""); setCode(""); },
        onError: (err) => setError((err as Error).message ?? "Failed"),
      },
    );
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
          <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code (slug)</Label>
              <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="eng" />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
            {error && <div className="col-span-full text-sm text-destructive" role="alert">{error}</div>}
          </form>
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
