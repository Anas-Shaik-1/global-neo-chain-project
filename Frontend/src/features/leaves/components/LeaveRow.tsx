import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApproveLeave, useCancelLeave, type Leave } from "../api/hooks";
import { LeaveStatusBadge } from "./LeaveStatusBadge";

interface Props {
  leave: Leave;
  variant: "admin" | "mine";
  onRejectClick?: (id: string) => void;
}

export function LeaveRow({ leave, variant, onRejectClick }: Props) {
  const approve = useApproveLeave();
  const cancel = useCancelLeave();

  return (
    <TableRow>
      {variant === "admin" ? (
        <TableCell>
          <div className="font-medium">{leave.userName ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{leave.userEmail ?? ""}</div>
        </TableCell>
      ) : null}
      <TableCell>{leave.type.charAt(0) + leave.type.slice(1).toLowerCase()}</TableCell>
      <TableCell>{leave.startDate}</TableCell>
      <TableCell>{leave.endDate}</TableCell>
      <TableCell className="max-w-xs truncate" title={leave.reason}>
        {leave.reason}
      </TableCell>
      <TableCell>
        <LeaveStatusBadge status={leave.status} />
        {leave.status === "REJECTED" && leave.decisionNotes ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {leave.decisionNotes}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        {variant === "admin" && leave.status === "PENDING" ? (
          <div className="inline-flex gap-2">
            <Button
              size="sm"
              onClick={() => approve.mutate(leave.id)}
              disabled={approve.isPending}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRejectClick?.(leave.id)}
            >
              Reject
            </Button>
          </div>
        ) : null}
        {variant === "mine" && leave.status === "PENDING" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancel.mutate(leave.id)}
            disabled={cancel.isPending}
          >
            Cancel
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
