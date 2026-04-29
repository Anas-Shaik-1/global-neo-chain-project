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

export const attendanceKeys = {
  all: ["attendance"] as const,
  month: (month: string) => ["attendance", "month", month] as const,
};

export interface AttendanceEntry {
  id: string;
  userId: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  lunchStart: string | null;
  lunchEnd: string | null;
  lunchMinutes: number;
  durationMinutes: number | null;
  isRemote: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface MonthSummary {
  entries: AttendanceEntry[];
  totalMinutes: number;
  daysWorked: number;
}

export function currentMonthString(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function todayUtcString(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useMyMonth(monthStr: string) {
  return useQuery({
    queryKey: attendanceKeys.month(monthStr),
    queryFn: async () => {
      const res = await api().get("/attendance/me", { params: { month: monthStr } });
      return res.data as MonthSummary;
    },
  });
}

export function useTodayAttendance() {
  const month = currentMonthString();
  const query = useMyMonth(month);
  const today = todayUtcString();
  const todayEntry = query.data?.entries.find((e) => e.date === today) ?? null;
  return { ...query, todayEntry };
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { notes?: string; isRemote?: boolean } = {}) => {
      const res = await api().post("/attendance/clock-in", input);
      return res.data as AttendanceEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success("Clocked in");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not clock in")),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { notes?: string } = {}) => {
      const res = await api().post("/attendance/clock-out", input);
      return res.data as AttendanceEntry;
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      const minutes = entry.durationMinutes ?? 0;
      const hours = Math.round((minutes / 60) * 10) / 10;
      toast.success(`Clocked out — ${hours}h worked`);
    },
    onError: (err) => toast.error(errorMessage(err, "Could not clock out")),
  });
}

export function useStartLunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api().post("/attendance/lunch-start", {});
      return res.data as AttendanceEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success("Lunch started");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not start lunch")),
  });
}

export function useEndLunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api().post("/attendance/lunch-end", {});
      return res.data as AttendanceEntry;
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success(`Lunch ended (${entry.lunchMinutes} min)`);
    },
    onError: (err) => toast.error(errorMessage(err, "Could not end lunch")),
  });
}
