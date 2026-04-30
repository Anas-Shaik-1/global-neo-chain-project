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
import { useAppSelector } from "@/app/hooks";
import {
  useCandidates,
  useApproveHr,
  useApproveAdmin,
  useRejectCandidate,
  type PublicProfile,
} from "../api/hooks";

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

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.items.length === 0 ? (
          <EmptyQueue stage={stage} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2">Applicant</TableHead>
                  <TableHead className="hidden px-2 sm:table-cell">Email</TableHead>
                  <TableHead className="hidden px-2 md:table-cell">Department</TableHead>
                  <TableHead className="hidden px-2 lg:table-cell">Applied</TableHead>
                  <TableHead className="px-2 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
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
    if (stage === "hr") approveHr.mutate();
    else approveAdmin.mutate();
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
        {candidate.departmentName ?? "—"}
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
