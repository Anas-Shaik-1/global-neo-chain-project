import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

const api = () => getApi();

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface Leave {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  decisionById: string | null;
  decisionByName: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedLeaves {
  items: Leave[];
  total: number;
  page: number;
  limit: number;
}

export const leaveKeys = {
  all: ["leaves"] as const,
  mine: (params: Record<string, unknown> = {}) => ["leaves", "mine", params] as const,
  list: (params: Record<string, unknown> = {}) => ["leaves", "all", params] as const,
};

export interface ListParams {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  type?: LeaveType;
  userId?: string;
  from?: string;
  to?: string;
}

export function useMyLeaves(params: ListParams = {}) {
  return useQuery({
    queryKey: leaveKeys.mine(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/leaves/mine", { params });
      return res.data as PagedLeaves;
    },
  });
}

export function useAllLeaves(params: ListParams = {}) {
  return useQuery({
    queryKey: leaveKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/leaves", { params });
      return res.data as PagedLeaves;
    },
  });
}

export interface CreateLeaveInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLeaveInput) => {
      const res = await api().post("/leaves", input);
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave request submitted");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not submit request")),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api().patch(`/leaves/${id}/cancel`);
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave cancelled");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not cancel")),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api().patch(`/leaves/${id}/approve`);
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave approved");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not approve")),
  });
}

export interface RejectInput {
  id: string;
  notes?: string;
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: RejectInput) => {
      const res = await api().patch(`/leaves/${id}/reject`, { notes });
      return res.data as Leave;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success("Leave rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not reject")),
  });
}
