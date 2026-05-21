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

export const BUG_STATUSES = ["OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export type BugLinkedTaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Bug {
  id: string;
  title: string;
  code: string;
  description: string;
  imageUrl: string | null;
  status: BugStatus;
  createdById: string;
  createdByName: string | null;
  /** Optional project this bug is filed against. Both fields are null when unassigned. */
  projectId: string | null;
  projectName: string | null;
  projectKey: string | null;
  /** Linked Task (set when this bug was promoted via "Create task"). */
  linkedTaskId: string | null;
  linkedTaskTitle: string | null;
  linkedTaskStatus: BugLinkedTaskStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedBugs {
  items: Bug[];
  total: number;
  page: number;
  limit: number;
}

export const bugKeys = {
  all: ["bugs"] as const,
  list: (params: Record<string, unknown>) => ["bugs", "list", params] as const,
  detail: (id: string) => ["bugs", "detail", id] as const,
};

interface ListParams {
  page?: number;
  limit?: number;
  status?: BugStatus;
  projectId?: string;
}

export function useBugs(params: ListParams = {}) {
  return useQuery({
    queryKey: bugKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/bugs", { params });
      return res.data as PagedBugs;
    },
  });
}

export interface CreateBugInput {
  title: string;
  description: string;
  /** Optional — file the bug against a specific project. */
  projectId?: string;
}

export function useCreateBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBugInput) => {
      const res = await api().post("/bugs", input);
      return res.data as Bug;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bugKeys.all });
      toast.success("Bug filed");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not file bug")),
  });
}

export interface UpdateBugInput {
  title?: string;
  description?: string;
  status?: BugStatus;
  /** `null` clears the project assignment; an id (re-)assigns. */
  projectId?: string | null;
}

export function useUpdateBug(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBugInput) => {
      const res = await api().patch(`/bugs/${id}`, input);
      return res.data as Bug;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bugKeys.all });
      toast.success("Bug updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update bug")),
  });
}

export interface CreateTaskFromBugInput {
  /** Optional override; defaults server-side to the bug's projectId. */
  projectId?: string;
  assigneeId?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "ENHANCEMENT";
}

/**
 * Promote a bug into a task. Returns the updated Bug (now carrying
 * `linkedTaskId` + title/status), so callers can immediately render the
 * "linked task" chip without a follow-up fetch.
 */
export function useCreateTaskFromBug(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskFromBugInput) => {
      const res = await api().post(`/bugs/${id}/create-task`, input);
      return res.data as Bug;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bugKeys.all });
      // The created task affects the dashboard's "Open tasks" count and
      // every task list — invalidate both so they refetch.
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Task created from bug");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create task")),
  });
}

export function useUploadBugImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api().post(`/bugs/${id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as Bug;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bugKeys.all });
      toast.success("Image uploaded");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not upload image")),
  });
}
