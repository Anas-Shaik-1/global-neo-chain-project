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
  candidates: (stage: "hr" | "admin") => ["employees", "candidates", stage] as const,
};

export type ApprovalStatus = "PENDING_HR" | "PENDING_ADMIN" | "ACTIVE" | "REJECTED";

export const departmentKeys = {
  all: ["departments"] as const,
  list: (params: Record<string, unknown>) => ["departments", "list", params] as const,
};

export interface PublicProfile {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "HR" | "EMPLOYEE";
  isProjectManager: boolean;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt?: string;
}

export interface FullProfile extends PublicProfile {
  hireDate?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | null;
  emergencyContact?: { name: string; phone: string; relationship: string } | null;
  resumeUrl?: string | null;
  approvalNotes?: string | null;
  hrApprovedAt?: string | null;
  adminApprovedAt?: string | null;
  rejectedAt?: string | null;
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

// Note: the legacy useCreateEmployee hook was removed when the
// self-registration + 2-stage approval pipeline replaced HR-creates-employee.
// New users go through `useRegister` (auth/api/hooks) and the candidate
// review flow below.

export function useCandidates(params: { stage: "hr" | "admin" }) {
  return useQuery({
    queryKey: employeeKeys.candidates(params.stage),
    queryFn: async () => {
      const res = await api().get("/employees/candidates", { params });
      return res.data as { items: PublicProfile[]; total: number; page: number; limit: number };
    },
  });
}

export function useApproveHr(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api().post(`/employees/${id}/approve-hr`);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees", "candidates"] });
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Approved — moved to Admin queue");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not approve candidate")),
  });
}

export function useApproveAdmin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api().post(`/employees/${id}/approve-admin`);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees", "candidates"] });
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Approved — account is now active");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not approve candidate")),
  });
}

export function useRejectCandidate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { notes?: string } = {}) => {
      const res = await api().post(`/employees/${id}/reject`, input);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees", "candidates"] });
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Candidate rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not reject candidate")),
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

export function usePromoteEmployeePM(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api().post(`/employees/${id}/promote-pm`);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Promoted to Project Manager");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to promote")),
  });
}

export function useDemoteEmployeePM(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api().post(`/employees/${id}/demote-pm`);
      return res.data as FullProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success("Demoted from Project Manager");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to demote")),
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

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  description?: string | null;
  managerId?: string | null;
}

export function useUpdateDepartment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateDepartmentInput) => {
      const res = await api().patch(`/departments/${id}`, patch);
      return res.data as Department;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: departmentKeys.all });
      toast.success("Department updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update department")),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api().delete(`/departments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: departmentKeys.all });
      toast.success("Department deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to delete department")),
  });
}
