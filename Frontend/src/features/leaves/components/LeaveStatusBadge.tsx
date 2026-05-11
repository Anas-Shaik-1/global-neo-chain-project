import { StatusBadge } from "@/components/common/StatusBadge";
import type { LeaveStatus } from "../api/hooks";

const TONE: Record<LeaveStatus, "warn" | "info" | "success" | "danger" | "default"> = {
  PENDING: "warn",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
};

const LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <StatusBadge tone={TONE[status]}>{LABEL[status]}</StatusBadge>;
}
