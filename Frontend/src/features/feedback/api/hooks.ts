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

export const FEEDBACK_KINDS = ["SUGGESTION", "COMPLAINT"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["OPEN", "REVIEWED", "ACTIONED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackEntry {
  id: string;
  kind: FeedbackKind;
  subject: string;
  body: string;
  status: FeedbackStatus;
  isAnonymous: boolean;
  /** Null when the entry is anonymous and the viewer isn't elevated/owner. */
  submitterId: string | null;
  submitterName: string | null;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedFeedback {
  items: FeedbackEntry[];
  total: number;
  page: number;
  limit: number;
}

export const feedbackKeys = {
  all: ["feedback"] as const,
  list: (params: Record<string, unknown>) => ["feedback", "list", params] as const,
  detail: (id: string) => ["feedback", "detail", id] as const,
};

interface ListParams {
  mine?: boolean;
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  page?: number;
  limit?: number;
}

export function useFeedbackList(params: ListParams = {}) {
  return useQuery({
    queryKey: feedbackKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/feedback", { params });
      return res.data as PagedFeedback;
    },
  });
}

export interface SubmitFeedbackInput {
  kind: FeedbackKind;
  subject: string;
  body: string;
  isAnonymous: boolean;
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitFeedbackInput) => {
      const res = await api().post("/feedback", input);
      return res.data as FeedbackEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Thanks — your feedback was sent.");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not submit feedback")),
  });
}

export interface ReviewFeedbackInput {
  status: FeedbackStatus;
  reviewNote?: string;
}

export function useReviewFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewFeedbackInput) => {
      const res = await api().post(`/feedback/${id}/review`, input);
      return res.data as FeedbackEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update")),
  });
}
