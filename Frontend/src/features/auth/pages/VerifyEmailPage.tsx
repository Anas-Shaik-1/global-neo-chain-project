import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmEmailVerification } from "../api/hooks";
import { AuthShell } from "../components/AuthShell";

type Status = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const confirm = useConfirmEmailVerification();
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState<string>(
    token ? "" : "No verification token found in this link.",
  );
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  // StrictMode fires effects twice in dev; guard so we only POST once.
  const fired = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (fired.current) return;
    fired.current = true;
    confirm.mutate(token, {
      onSuccess: (data) => {
        setVerifiedEmail(data.email);
        setStatus("success");
      },
      onError: (err) => {
        let msg = "Verification failed. The link may have expired.";
        if (axios.isAxiosError(err)) {
          const data = err.response?.data as { message?: string } | undefined;
          if (data?.message) msg = data.message;
        }
        setErrorMessage(msg);
        setStatus("error");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthShell
      hero={{
        eyebrow: "Email verification",
        title: (
          <>
            One click. You&rsquo;re{" "}
            <span className="bg-gradient-to-r from-[hsl(195_90%_60%)] to-[hsl(210_90%_55%)] bg-clip-text text-transparent">
              in.
            </span>
          </>
        ),
        subtitle:
          "We're checking the verification link you clicked. This only takes a moment.",
        pills: ["Token expires in 24 hours"],
      }}
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Verifying&hellip;</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute inset-0 -z-0 rounded-full bg-emerald-500/20 blur-xl"
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" strokeWidth={1.75} />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  Email verified
                </h2>
                {verifiedEmail && (
                  <p className="font-mono text-xs text-muted-foreground">{verifiedEmail}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              className="h-11 w-full text-sm font-semibold"
              onClick={() => navigate("/login", { replace: true })}
            >
              Continue to sign in
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute inset-0 -z-0 rounded-full bg-amber-500/20 blur-xl"
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                  <AlertTriangle className="h-8 w-8 text-amber-500" strokeWidth={1.75} />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  Verification failed
                </h2>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild type="button" className="h-11 w-full text-sm font-semibold">
                <Link to="/login">Back to sign in</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Sign in and use the &ldquo;Resend&rdquo; button on the banner to request a new
                verification link.
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
