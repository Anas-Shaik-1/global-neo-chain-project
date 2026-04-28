import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEmployeesList } from "../api/hooks";
import { useAppSelector } from "@/app/hooks";

export function PeopleListPage() {
  const [q, setQ] = useState("");
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployeesList({ q, page: 1, limit: 50 });
  const canCreate = me?.role === "HR" || me?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>People</CardTitle>
          {canCreate && (
            <Button asChild size="sm"><Link to="/people/new">+ New employee</Link></Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search employees"
          />
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Name</th>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => {
                    const initials = p.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr key={p.id} className={"border-b border-border/50 " + (!p.isActive ? "opacity-50" : "")}>
                        <td className="flex items-center gap-3 py-2">
                          <Avatar className="h-8 w-8">
                            {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          {p.name}
                        </td>
                        <td>{p.jobTitle ?? "—"}</td>
                        <td>{p.departmentName ?? "—"}</td>
                        <td>{p.email}</td>
                        <td><Link to={`/people/${p.id}`} className="text-primary underline-offset-4 hover:underline">View</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.items.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">No employees match your search.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
