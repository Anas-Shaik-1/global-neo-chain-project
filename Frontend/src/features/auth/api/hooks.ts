import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

export type ApprovalStatus = "PENDING_HR" | "PENDING_ADMIN" | "ACTIVE" | "REJECTED";

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

/**
 * Trigger a fresh verification-email dispatch for the currently-authenticated
 * user. The backend hashes the token, persists it, and emails a 24h-valid
 * link via the configured MailDriver.
 */
export function useResendVerification() {
  return useMutation({
    mutationFn: async () => {
      await getApi().post("/auth/verify-email/request");
    },
    onSuccess: () => {
      toast.success("Verification email sent. Check your inbox.");
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Could not send verification email."));
    },
  });
}

export interface ConfirmEmailVerificationResponse {
  email: string;
}

/**
 * Exchange a raw token (from the email link) for a server-side flip of
 * `isVerified`. The /verify-email page calls this once on mount.
 */
export function useConfirmEmailVerification() {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await getApi().post<ConfirmEmailVerificationResponse>(
        "/auth/verify-email/confirm",
        { token },
      );
      return res.data;
    },
  });
}

// --- Public self-registration -------------------------------------------------

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  phone?: string;
  departmentId?: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  approvalStatus: ApprovalStatus;
}

/**
 * Submit a public self-registration. The created user starts in PENDING_HR;
 * they cannot log in until both HR and Admin sign off and the status flips
 * to ACTIVE. The mutation returns the registration shape — toast/error
 * rendering is left to the caller, which renders a richer success state.
 */
export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const payload: Record<string, unknown> = {
        email: input.email,
        name: input.name,
        password: input.password,
      };
      if (input.phone) payload.phone = input.phone;
      if (input.departmentId) payload.departmentId = input.departmentId;
      const res = await getApi().post<RegisterResponse>("/auth/register", payload);
      return res.data;
    },
  });
}

/**
 * Public lookup: where am I in the queue? Stale-time 0 so users get the
 * latest answer every time they re-check on the success page.
 */
export function useRegistrationStatus(email: string | null | undefined) {
  return useQuery({
    queryKey: ["auth", "registration-status", email],
    enabled: !!email,
    staleTime: 0,
    queryFn: async () => {
      const res = await getApi().get<{ approvalStatus: ApprovalStatus }>(
        "/auth/registration-status",
        { params: { email } },
      );
      return res.data;
    },
    retry: false,
  });
}
