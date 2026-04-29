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

export const employeeKeys = {
  all: ["employees"] as const,
  list: (params: Record<string, unknown>) => ["employees", "list", params] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
  positions: (id: string) => ["employees", "positions", id] as const,
};

export const departmentKeys = {
  all: ["departments"] as const,
  list: (params: Record<string, unknown>) => ["departments", "list", params] as const,
};

export interface PublicProfile {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "HR" | "EMPLOYEE" | "PM";
  isActive: boolean;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface FullProfile extends PublicProfile {
  hireDate?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | null;
  emergencyContact?: { name: string; phone: string; relationship: string } | null;
  resumeUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useEmployeesList(params: { q?: string; department?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => {
      const res = await api().get("/employees", { params });
      return res.data as { items: PublicProfile[]; total: number; page: number; limit: number };
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await api().get(`/employees/${id}`);
      return res.data as FullProfile;
    },
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<FullProfile>) => {
      const res = await api().patch(`/employees/${id}`, patch);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update profile")),
  });
}

export function useUploadAvatar(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api().post(`/employees/${id}/avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as { avatarUrl: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      toast.success("Avatar updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not upload avatar")),
  });
}

export function useUploadResume(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api().post(`/employees/${id}/resume`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as { resumeUrl: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      toast.success("Resume updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not upload resume")),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name: string; role: string; jobTitle?: string; departmentId?: string }) => {
      const res = await api().post("/employees", input);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Employee created — temp password logged on backend");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create employee")),
  });
}

export function useDeactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api().post(`/employees/${id}/deactivate`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Employee deactivated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not deactivate employee")),
  });
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useDepartmentsList(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: departmentKeys.list(params),
    queryFn: async () => {
      const res = await api().get("/departments", { params });
      return res.data as { items: Department[]; total: number; page: number; limit: number };
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; code: string; description?: string }) => {
      const res = await api().post("/departments", input);
      return res.data as Department;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: departmentKeys.all });
      toast.success("Department created");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create department")),
  });
}
