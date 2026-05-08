import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "ENHANCEMENT";

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  createdById: string;
  createdByName?: string | null;
  dueDate?: string | null;
  parentTaskId?: string | null;
  subtaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskActivityKind =
  | "CREATED"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "PRIORITY_CHANGED"
  | "DUE_DATE_CHANGED"
  | "TITLE_CHANGED"
  | "COMMENTED";

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string;
  actorName?: string | null;
  kind: TaskActivityKind;
  fromValue?: string | null;
  toValue?: string | null;
  summary?: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
}

export const projectKeys = {
  all: ["projects"] as const,
  list: (params: Record<string, unknown>) => ["projects", "list", params] as const,
  detail: (id: string) => ["projects", "detail", id] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  byProject: (projectId: string, filters: Record<string, unknown>) =>
    ["tasks", "by-project", projectId, filters] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
  comments: (taskId: string) => ["tasks", "comments", taskId] as const,
  activity: (taskId: string) => ["tasks", "activity", taskId] as const,
  subtasks: (taskId: string) => ["tasks", "subtasks", taskId] as const,
};

export function useProjects(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: async () => {
      const res = await api().get("/projects", { params });
      return res.data as { items: Project[]; total: number; page: number; limit: number };
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await api().get(`/projects/${id}`);
      return res.data as Project;
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; key: string; description?: string }) => {
      const res = await api().post("/projects", input);
      return res.data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Project created");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create project")),
  });
}

export interface TaskFilters {
  status?: TaskStatus;
  assignee?: string;
  priority?: TaskPriority;
}

export function useTasks(projectId: string | undefined, filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId ?? "", filters as Record<string, unknown>),
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api().get(`/projects/${projectId}/tasks`, { params: filters });
      return res.data as Task[];
    },
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await api().get(`/tasks/${id}`);
      return res.data as Task;
    },
  });
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  parentTaskId?: string | null;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api().post("/tasks", input);
      return res.data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Task created");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create task")),
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateTaskInput) => {
      const res = await api().patch(`/tasks/${id}`, patch);
      return res.data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      if (id) qc.invalidateQueries({ queryKey: taskKeys.activity(id) });
      toast.success("Task updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update task")),
  });
}

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.comments(taskId ?? ""),
    enabled: !!taskId,
    queryFn: async () => {
      const res = await api().get(`/tasks/${taskId}/comments`);
      return res.data as Comment[];
    },
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await api().post(`/tasks/${taskId}/comments`, { body });
      return res.data as Comment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.activity(taskId) });
      toast.success("Comment added");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not add comment")),
  });
}

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.activity(taskId ?? ""),
    enabled: !!taskId,
    queryFn: async () => {
      const res = await api().get(`/tasks/${taskId}/activity`);
      return res.data as TaskActivity[];
    },
  });
}

export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.subtasks(taskId ?? ""),
    enabled: !!taskId,
    queryFn: async () => {
      const res = await api().get(`/tasks/${taskId}/subtasks`);
      return res.data as Task[];
    },
  });
}
