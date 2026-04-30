import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

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
