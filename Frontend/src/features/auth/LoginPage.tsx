import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { loginThunk, login2FAThunk } from "./authThunks";

const FEATURE_PILLS = ["Time tracking", "Approvals", "Payroll"];

type Stage = "credentials" | "totp";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [stage, setStage] = useState<Stage>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmitCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const action = await dispatch(loginThunk({ email, password }));
    setSubmitting(false);
    if (action.type.endsWith("/rejected")) {
      setError((action.payload as string) ?? "Login failed");
      return;
    }
    const result = action.payload as { kind: "ok" | "2fa-required" } | undefined;
    if (result?.kind === "2fa-required") {
      setStage("totp");
    }
  }

  async function onSubmitTotp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const action = await dispatch(login2FAThunk({ email, password, token: totp }));
    setSubmitting(false);
    if (action.type.endsWith("/rejected")) {
      setError((action.payload as string) ?? "Login failed");
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[3fr_2fr]">
      {/* Left brand panel */}
      <aside className="relative hidden overflow-hidden bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Animated gradient mesh */}
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 15% 20%, hsla(195 90% 55% / 0.18) 0px, transparent 45%)",
              "radial-gradient(circle at 85% 75%, hsla(210 90% 50% / 0.20) 0px, transparent 50%)",
              "radial-gradient(circle at 60% 10%, hsla(195 90% 55% / 0.10) 0px, transparent 40%)",
            ].join(","),
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 flex flex-col gap-12">
          <div className="max-w-xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Global NeoChain EMS
            </span>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground xl:text-6xl">
              Run your people ops with{" "}
              <span className="bg-gradient-to-r from-[hsl(195_90%_60%)] to-[hsl(210_90%_55%)] bg-clip-text text-transparent">
                quiet confidence.
              </span>
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              The unified workspace for HR, finance and managers at Global NeoChain — directory,
              attendance, tasks, expenses and payroll in one calm place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FEATURE_PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <Logo showTagline={false} />
        </div>
      </aside>

      {/* Right form panel */}
      <main className="relative flex flex-col items-center justify-center bg-background px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <Logo showTagline={false} />
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {stage === "credentials" ? "Welcome back" : "Two-factor"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {stage === "credentials"
                ? "Sign in to your Global NeoChain workspace"
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>

          {stage === "credentials" ? (
            <form onSubmit={onSubmitCredentials} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Work email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@globalneochain.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
              {error && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="group relative">
                <div className="absolute -inset-px rounded-md bg-gradient-to-r from-[hsl(195_90%_55%)] to-[hsl(210_90%_50%)] opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-60" />
                <Button type="submit" className="relative h-11 w-full text-sm font-semibold" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmitTotp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="totp" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Authenticator code
                </Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 font-mono tracking-[0.4em]"
                  placeholder="123456"
                  autoFocus
                />
              </div>
              {error && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={submitting || totp.length !== 6}>
                {submitting ? "Verifying…" : "Verify"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStage("credentials");
                  setTotp("");
                  setError(null);
                }}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Back to sign in
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Need access? Talk to your HR admin.
          </p>
        </div>
      </main>
    </div>
  );
}
