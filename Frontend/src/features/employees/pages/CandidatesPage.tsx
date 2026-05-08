import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAppSelector } from "@/app/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCandidates,
  useApproveHr,
  useApproveAdmin,
  useRejectCandidate,
  useDepartmentsList,
  type PublicProfile,
} from "../api/hooks";

const NO_DEPT = "__none__";

type Stage = "hr" | "admin";

const STAGE_LABELS: Record<Stage, string> = {
  hr: "Awaiting HR",
  admin: "Awaiting Admin",
};

export function CandidatesPage() {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = me?.role === "ADMIN";
  const [stage, setStage] = useState<Stage>("hr");

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Candidates"
        description="People who applied to join Global NeoChain. HR signs off first; an Admin gives the final approval."
      />

      <Tabs value={stage} onValueChange={(v) => setStage(v as Stage)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="hr">{STAGE_LABELS.hr}</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">{STAGE_LABELS.admin}</TabsTrigger>}
        </TabsList>

        <TabsContent value="hr">
          <CandidatesTable stage="hr" />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin">
            <CandidatesTable stage="admin" />
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  );
}

function CandidatesTable({ stage }: { stage: Stage }) {
  const { data, isLoading } = useCandidates({ stage });
  const [rejectTarget, setRejectTarget] = useState<PublicProfile | null>(null);
  const paginated = usePagination(data?.items ?? [], 10);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.items.length === 0 ? (
          <EmptyQueue stage={stage} />
        ) : (
          <>
            {/* Mobile: card stack */}
            <div className="space-y-3 md:hidden">
              {paginated.items.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  stage={stage}
                  onReject={() => setRejectTarget(c)}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-2">Applicant</TableHead>
                    <TableHead className="px-2">Email</TableHead>
                    <TableHead className="hidden px-2 md:table-cell">Department</TableHead>
                    <TableHead className="hidden px-2 lg:table-cell">Applied</TableHead>
                    <TableHead className="px-2 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.items.map((c) => (
                    <CandidateRow
                      key={c.id}
                      candidate={c}
                      stage={stage}
                      onReject={() => setRejectTarget(c)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={paginated.page}
              pageSize={paginated.pageSize}
              totalPages={paginated.totalPages}
              totalItems={paginated.totalItems}
              onPageChange={paginated.setPage}
              onPageSizeChange={paginated.setPageSize}
            />
          </>
        )}

        {rejectTarget && (
          <RejectDialog
            candidate={rejectTarget}
            onClose={() => setRejectTarget(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mobile-first card layout for a candidate row. Mirrors the desktop table
 * columns: applicant identity + status badge at the top, secondary metadata
 * (email · department · applied date) in the middle, full-width action
 * buttons at the bottom for easy thumb reach.
 */
function CandidateCard({
  candidate,
  stage,
  onReject,
}: {
  candidate: PublicProfile;
  stage: Stage;
  onReject: () => void;
}) {
  const approveHr = useApproveHr(candidate.id);
  const approveAdmin = useApproveAdmin(candidate.id);
  const showDeptPicker = stage === "hr";
  const departmentsQ = useDepartmentsList({ limit: 100 });
  const [selectedDept, setSelectedDept] = useState<string>(
    candidate.departmentId ?? NO_DEPT,
  );
  const initials = candidate.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const applied = candidate.createdAt
    ? new Date(candidate.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const onApprove = () => {
    if (stage === "hr") {
      approveHr.mutate({
        departmentId: selectedDept === NO_DEPT ? null : selectedDept,
      });
    } else {
      approveAdmin.mutate();
    }
  };
  const isApproving = stage === "hr" ? approveHr.isPending : approveAdmin.isPending;

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              {candidate.name}
            </span>
            <StatusBadge tone={stage === "hr" ? "warn" : "info"}>
              {stage === "hr" ? "Pending HR" : "Pending Admin"}
            </StatusBadge>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {candidate.email}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Department
          </dt>
          <dd className="mt-0.5 text-foreground">
            {showDeptPicker ? (
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPT}>Unassigned</SelectItem>
                  {(departmentsQ.data?.items ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              candidate.departmentName ?? "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Applied
          </dt>
          <dd className="mt-0.5 text-foreground">{applied}</dd>
        </div>
      </dl>

      <div className="mt-3 flex gap-2 border-t border-border/40 pt-3">
        <Button
          size="sm"
          className="flex-1"
          onClick={onApprove}
          disabled={isApproving}
        >
          {isApproving ? "Approving…" : "Approve"}
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function EmptyQueue({ stage }: { stage: Stage }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/30">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">0</span>
      </div>
      <p className="text-sm font-medium text-foreground">All clear</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {stage === "hr"
          ? "No applicants are waiting for HR review."
          : "No applicants are waiting for final Admin approval."}
      </p>
    </div>
  );
}

function CandidateRow({
  candidate,
  stage,
  onReject,
}: {
  candidate: PublicProfile;
  stage: Stage;
  onReject: () => void;
}) {
  const approveHr = useApproveHr(candidate.id);
  const approveAdmin = useApproveAdmin(candidate.id);
  // Department picker is only meaningful at HR stage — once the candidate is
  // in the admin queue HR has already placed them.
  const showDeptPicker = stage === "hr";
  const departmentsQ = useDepartmentsList({ limit: 100 });
  const [selectedDept, setSelectedDept] = useState<string>(
    candidate.departmentId ?? NO_DEPT,
  );
  const initials = candidate.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const applied = candidate.createdAt
    ? new Date(candidate.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const onApprove = () => {
    if (stage === "hr") {
      approveHr.mutate({
        departmentId: selectedDept === NO_DEPT ? null : selectedDept,
      });
    } else {
      approveAdmin.mutate();
    }
  };
  const isApproving = stage === "hr" ? approveHr.isPending : approveAdmin.isPending;

  return (
    <TableRow>
      <TableCell className="px-2 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{candidate.name}</span>
            <StatusBadge tone={stage === "hr" ? "warn" : "info"}>
              {stage === "hr" ? "Pending HR" : "Pending Admin"}
            </StatusBadge>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden px-2 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
        {candidate.email}
      </TableCell>
      <TableCell className="hidden px-2 py-3 text-muted-foreground md:table-cell">
        {showDeptPicker ? (
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEPT}>Unassigned</SelectItem>
              {(departmentsQ.data?.items ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          (candidate.departmentName ?? "—")
        )}
      </TableCell>
      <TableCell className="hidden px-2 py-3 text-muted-foreground lg:table-cell">
        {applied}
      </TableCell>
      <TableCell className="px-2 py-3 text-right">
        <div className="inline-flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={isApproving}>
            {isApproving ? "Approving…" : "Approve"}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            Reject
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RejectDialog({
  candidate,
  onClose,
}: {
  candidate: PublicProfile;
  onClose: () => void;
}) {
  const reject = useRejectCandidate(candidate.id);
  const [notes, setNotes] = useState("");

  const onConfirm = () => {
    reject.mutate(
      { notes: notes.trim() || undefined },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {candidate.name}?</DialogTitle>
          <DialogDescription>
            The applicant will be marked as rejected and won't be able to log in. You can leave a
            short note for the audit trail (HR/Admin only).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label
            htmlFor="reject-notes"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Note (optional)
          </label>
          <Textarea
            id="reject-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Not a fit for the role they applied for"
            rows={4}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reject.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={reject.isPending}>
            {reject.isPending ? "Rejecting…" : "Confirm reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
