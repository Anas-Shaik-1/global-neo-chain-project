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
  /**
   * Profile picture is mandatory at registration. Sent as multipart so the
   * backend can persist it alongside the user record in one round-trip.
   */
  avatar: File;
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
 *
 * Department assignment is HR/Admin work, done after approval — there is no
 * `departmentId` on this payload by design.
 */
export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const form = new FormData();
      form.set("email", input.email);
      form.set("name", input.name);
      form.set("password", input.password);
      if (input.phone) form.set("phone", input.phone);
      // The backend uses multer.single("file") on this route — keep the
      // field name in sync.
      form.set("file", input.avatar);
      const res = await getApi().post<RegisterResponse>("/auth/register", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
  });
}

// --- Phone verification (6-digit SMS OTP) -----------------------------------

/**
 * Ask the backend to dispatch a fresh 6-digit OTP to the user's phone via the
 * configured SmsDriver. In development the {@link ConsoleSmsDriver} prints
 * the OTP to the backend log so devs can grab it locally — the toast hints
 * at this so testers know where to look.
 */
export function useRequestPhoneVerification() {
  return useMutation({
    mutationFn: async () => {
      await getApi().post("/auth/phone/request-verify");
    },
    onSuccess: () => {
      toast.success(
        "Verification code sent to your phone (check backend console for dev).",
      );
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Could not send verification code."));
    },
  });
}

/**
 * Submit the 6-digit OTP. On success the server flips `isPhoneVerified=true`
 * and clears the active code so it can't be replayed; the dialog closes and
 * the caller invalidates the profile query to refresh the badge.
 */
export function useConfirmPhoneVerification() {
  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      await getApi().post("/auth/phone/verify", { code });
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Could not verify phone."));
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
