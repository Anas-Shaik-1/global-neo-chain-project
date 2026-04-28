import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/api/axios";

const api = () => getApi();

export const BREAKDOWN_KINDS = ["EARNING", "DEDUCTION"] as const;
export type BreakdownKind = (typeof BREAKDOWN_KINDS)[number];

export interface BreakdownItem {
  label: string;
  amount: number;
  kind: BreakdownKind;
}

export interface Payslip {
  id: string;
  userId: string;
  userName: string | null;
  month: string;
  currency: string;
  gross: number;
  breakdown: BreakdownItem[];
  netAmount: number;
  notes: string | null;
  generatedById: string;
  generatedByName: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedPayslips {
  items: Payslip[];
  total: number;
  page: number;
  limit: number;
}

export const payrollKeys = {
  all: ["payroll"] as const,
  myList: (params: Record<string, unknown>) => ["payroll", "mine", params] as const,
  allList: (params: Record<string, unknown>) => ["payroll", "all", params] as const,
  detail: (id: string) => ["payroll", "detail", id] as const,
};

export interface ListMyParams {
  month?: string;
  page?: number;
  limit?: number;
}

export interface ListAllParams extends ListMyParams {
  userId?: string;
}

export function useMyPayslips(params: ListMyParams = {}) {
  return useQuery({
    queryKey: payrollKeys.myList(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/payroll/me", { params });
      return res.data as PagedPayslips;
    },
  });
}

export function useAllPayslips(params: ListAllParams = {}, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.allList(params as Record<string, unknown>),
    enabled,
    queryFn: async () => {
      const res = await api().get("/payroll", { params });
      return res.data as PagedPayslips;
    },
  });
}

export function useGetPayslip(id: string | undefined) {
  return useQuery({
    queryKey: payrollKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await api().get(`/payroll/${id}`);
      return res.data as Payslip;
    },
  });
}

export interface CreatePayslipInput {
  userId: string;
  month: string;
  currency?: string;
  gross: number;
  breakdown?: BreakdownItem[];
  notes?: string;
}

export function useCreatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePayslipInput) => {
      const res = await api().post("/payroll", input);
      return res.data as Payslip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}

/**
 * Download a payslip PDF programmatically. Uses the authenticated axios
 * instance (so the bearer token is attached), receives a binary blob, and
 * triggers a save via a synthetic anchor click.
 */
export async function downloadPayslipPdf(id: string, filename?: string): Promise<void> {
  const res = await api().get(`/payroll/${id}/pdf`, { responseType: "blob" });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `payslip-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Slight delay so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
