import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector } from "@/app/hooks";
import {
  useAllLeaves,
  useMyLeaves,
  LEAVE_STATUSES,
  type LeaveStatus,
} from "../api/hooks";
import { RequestLeaveDialog } from "../components/RequestLeaveDialog";
import { RejectLeaveDialog } from "../components/RejectLeaveDialog";
import { LeaveRow } from "../components/LeaveRow";

const FILTERS: { value: "ALL" | LeaveStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  ...LEAVE_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
];

function EmployeeView() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useMyLeaves({ limit: 50 });

  return (
    <PageContainer>
      <PageHeader
        title="Leaves"
        description="File leave requests and track their status."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Request leave
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : data && data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <LeaveRow key={l.id} leave={l} variant="mine" />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No leave requests yet. Click "Request leave" to create one.
            </div>
          )}
        </CardContent>
      </Card>
      <RequestLeaveDialog open={open} onOpenChange={setOpen} />
    </PageContainer>
  );
}

function AdminView() {
  const [filter, setFilter] = useState<"ALL" | LeaveStatus>("PENDING");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const params = useMemo(
    () => (filter === "ALL" ? { limit: 100 } : { status: filter, limit: 100 }),
    [filter],
  );
  const { data, isLoading } = useAllLeaves(params);

  return (
    <PageContainer>
      <PageHeader
        title="Leaves"
        description="Review and decide on incoming leave requests."
        actions={
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Request leave
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : data && data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <LeaveRow
                    key={l.id}
                    leave={l}
                    variant="admin"
                    onRejectClick={(id) => setRejectId(id)}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No requests match this filter.
            </div>
          )}
        </CardContent>
      </Card>
      <RequestLeaveDialog open={open} onOpenChange={setOpen} />
      <RejectLeaveDialog
        open={rejectId !== null}
        onOpenChange={(v) => (!v ? setRejectId(null) : null)}
        leaveId={rejectId}
      />
    </PageContainer>
  );
}

export function LeavesPage() {
  const me = useAppSelector((s) => s.auth.user);
  return me?.role === "ADMIN" ? <AdminView /> : <EmployeeView />;
}
