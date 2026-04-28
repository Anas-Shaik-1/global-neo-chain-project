import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getApi } from "@/api/axios";

const api = () => getApi();

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
  durationMinutes: number | null;
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
    mutationFn: async (input: { notes?: string } = {}) => {
      const res = await api().post("/attendance/clock-in", input);
      return res.data as AttendanceEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { notes?: string } = {}) => {
      const res = await api().post("/attendance/clock-out", input);
      return res.data as AttendanceEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}
