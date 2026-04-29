import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useEmployeesList } from "../api/hooks";
import { useAppSelector } from "@/app/hooks";

export function PeopleListPage() {
  const [q, setQ] = useState("");
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployeesList({ q, page: 1, limit: 50 });
  const canCreate = me?.role === "HR" || me?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="The directory of everyone at Global NeoChain."
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link to="/people/new">+ New employee</Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Input
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search employees"
          />
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : data.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No employees match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2">Name</TableHead>
                  <TableHead className="px-2">Title</TableHead>
                  <TableHead className="px-2">Department</TableHead>
                  <TableHead className="px-2">Email</TableHead>
                  <TableHead className="px-2 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => {
                  const initials = p.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <TableRow key={p.id} className={!p.isActive ? "opacity-60" : undefined}>
                      <TableCell className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{p.name}</span>
                              {p.isProjectManager && (
                                <span
                                  className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                                  title="Project Manager"
                                >
                                  PM
                                </span>
                              )}
                            </div>
                            <StatusBadge tone={p.isActive ? "success" : "default"}>
                              {p.isActive ? "Active" : "Inactive"}
                            </StatusBadge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-3 text-muted-foreground">
                        {p.jobTitle ?? "—"}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-muted-foreground">
                        {p.departmentName ?? "—"}
                      </TableCell>
                      <TableCell className="px-2 py-3 font-mono text-xs text-muted-foreground">
                        {p.email}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-right">
                        <Link
                          to={`/people/${p.id}`}
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
