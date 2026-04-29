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

export interface CallParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export type CallStatus =
  | "INVITED"
  | "ACTIVE"
  | "ENDED"
  | "REJECTED"
  | "MISSED";

export type CallEndReason = "HANGUP" | "REJECT" | "TIMEOUT" | "ERROR";

export interface CallSession {
  id: string;
  caller: CallParticipant;
  callee: CallParticipant;
  status: CallStatus;
  startedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endReason: CallEndReason | null;
}

export const callKeys = {
  all: ["calls"] as const,
  history: ["calls", "history"] as const,
};

export function useInitiateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calleeId: string) => {
      const res = await api().post("/calls", { calleeId });
      return res.data as CallSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: callKeys.history }),
  });
}

export function useEndCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (callId: string) => {
      const res = await api().post(`/calls/${callId}/end`);
      return res.data as CallSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: callKeys.history });
      // No success toast — the UI already reflects the ended-call state.
    },
    onError: (err) => toast.error(errorMessage(err, "Could not end call")),
  });
}

export function useCallHistory(limit = 50) {
  return useQuery({
    queryKey: callKeys.history,
    queryFn: async () => {
      const res = await api().get("/calls/me", { params: { limit } });
      return res.data as CallSession[];
    },
  });
}
