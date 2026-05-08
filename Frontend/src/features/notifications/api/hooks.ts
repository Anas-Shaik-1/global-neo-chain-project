import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/api/axios";
import { onNotification } from "@/features/chat/socket";

const api = () => getApi();

export const NOTIFICATION_KINDS = [
  "EXPENSE_SUBMITTED",
  "EXPENSE_APPROVED",
  "EXPENSE_REJECTED",
  "PAYSLIP_AVAILABLE",
  "TASK_ASSIGNED",
  "TASK_COMMENTED",
  "EMPLOYEE_VERIFIED",
  "EMPLOYEE_DEACTIVATED",
  "DEPARTMENT_ASSIGNMENT",
  "PROMOTED_TO_PM",
  "DEMOTED_FROM_PM",
  "CANDIDATE_AWAITING_REVIEW",
  "CANDIDATE_HR_APPROVED",
  "CANDIDATE_REJECTED",
  "CANDIDATE_REGISTERED",
  "CALL_MISSED",
  "BUG_ASSIGNED",
  "BUG_RESOLVED",
  "TWO_FA_ENABLED",
  "TWO_FA_DISABLED",
  "PASSWORD_CHANGED",
  "ATTENDANCE_REMINDER",
  "ATTENDANCE_EDITED",
  "ATTENDANCE_AUTO_CHECKOUT",
  "NEW_MESSAGE",
  "FEEDBACK_SUBMITTED",
  "CALENDAR_INVITE",
  "CALENDAR_REMINDER",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: Record<string, unknown>) => ["notifications", "list", params] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

export interface ListParams {
  unread?: boolean;
  limit?: number;
}

export function useNotifications(params: ListParams = {}) {
  return useQuery({
    queryKey: notificationKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const query: Record<string, unknown> = {};
      if (params.unread) query.unread = "true";
      if (params.limit) query.limit = params.limit;
      const res = await api().get("/notifications/me", { params: query });
      return res.data as { items: AppNotification[] };
    },
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      const res = await api().get("/notifications/me/unread-count");
      return res.data as { count: number };
    },
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api().post(`/notifications/me/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api().post("/notifications/me/read-all");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Subscribes to backend `notification:new` socket events and invalidates the
 * notifications + unread-count queries so the UI updates instantly without
 * waiting for the 30s poll. Mount once near the auth-gated app shell.
 */
export function useNotificationsRealtime(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const off = onNotification(() => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    });
    return off;
  }, [qc]);
}
