import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/api/axios";

const api = () => getApi();

export const EXPENSE_CATEGORIES = [
  "TRAVEL",
  "MEALS",
  "SOFTWARE",
  "HARDWARE",
  "OFFICE",
  "TRAINING",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface Expense {
  id: string;
  userId: string;
  userName: string | null;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  incurredOn: string;
  receiptUrl: string | null;
  status: ExpenseStatus;
  decisionById: string | null;
  decisionByName: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PagedExpenses {
  items: Expense[];
  total: number;
  page: number;
  limit: number;
}

export const expenseKeys = {
  all: ["expenses"] as const,
  myList: (params: Record<string, unknown>) => ["expenses", "mine", params] as const,
  allList: (params: Record<string, unknown>) => ["expenses", "all", params] as const,
  detail: (id: string) => ["expenses", "detail", id] as const,
};

export interface ListMyParams {
  status?: ExpenseStatus;
  page?: number;
  limit?: number;
}

export interface ListAllParams extends ListMyParams {
  userId?: string;
}

export function useMyExpenses(params: ListMyParams = {}) {
  return useQuery({
    queryKey: expenseKeys.myList(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api().get("/expenses/me", { params });
      return res.data as PagedExpenses;
    },
  });
}

export function useAllExpenses(params: ListAllParams = {}, enabled = true) {
  return useQuery({
    queryKey: expenseKeys.allList(params as Record<string, unknown>),
    enabled,
    queryFn: async () => {
      const res = await api().get("/expenses", { params });
      return res.data as PagedExpenses;
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: expenseKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await api().get(`/expenses/${id}`);
      return res.data as Expense;
    },
  });
}

export interface CreateExpenseInput {
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  description: string;
  incurredOn: string;
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const res = await api().post("/expenses", input);
      return res.data as Expense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseKeys.all }),
  });
}

export interface DecideInput {
  id: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
}

export function useDecideExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }: DecideInput) => {
      const res = await api().post(`/expenses/${id}/decide`, { decision, note });
      return res.data as Expense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseKeys.all }),
  });
}

export interface UploadReceiptInput {
  id: string;
  file: File;
}

export function useUploadReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: UploadReceiptInput) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api().post(`/expenses/${id}/receipt`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as Expense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseKeys.all }),
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api().delete(`/expenses/${id}/receipt`);
      return res.data as Expense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseKeys.all }),
  });
}
