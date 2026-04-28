import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/api/axios";

const api = () => getApi();

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
    onSuccess: () => qc.invalidateQueries({ queryKey: callKeys.history }),
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
