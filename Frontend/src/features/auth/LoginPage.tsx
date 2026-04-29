import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Logo } from "@/components/brand/Logo";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { loginThunk, login2FAThunk } from "./authThunks";
import {
  Login2FASchema,
  LoginSchema,
  type Login2FAValues,
  type LoginValues,
} from "./schemas";

const FEATURE_PILLS = ["Time tracking", "Approvals", "Payroll"];

type Stage = "credentials" | "totp";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [stage, setStage] = useState<Stage>("credentials");
  const [error, setError] = useState<string | null>(null);
  // We hold the credentials in component state so we can re-use them when the
  // server demands a TOTP token — the 2FA endpoint expects email + password +
  // token together.
  const [credentials, setCredentials] = useState<LoginValues>({
    email: "",
    password: "",
  });

  const credentialsForm = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const totpForm = useForm<Login2FAValues>({
    resolver: zodResolver(Login2FASchema),
    defaultValues: { token: "" },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmitCredentials(values: LoginValues) {
    setError(null);
    setCredentials(values);
    const action = await dispatch(loginThunk(values));
    if (action.type.endsWith("/rejected")) {
      setError((action.payload as string) ?? "Login failed");
      return;
    }
    const result = action.payload as { kind: "ok" | "2fa-required" } | undefined;
    if (result?.kind === "2fa-required") {
      setStage("totp");
      totpForm.reset({ token: "" });
    }
  }

  async function onSubmitTotp(values: Login2FAValues) {
    setError(null);
    const action = await dispatch(
      login2FAThunk({ email: credentials.email, password: credentials.password, token: values.token }),
    );
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
            <Form {...credentialsForm}>
              <form
                onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
                className="space-y-5"
                noValidate
              >
                <FormField
                  control={credentialsForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Work email
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@globalneochain.com"
                          className="h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={credentialsForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <div className="text-right">
                        <Link
                          to="/forgot-password"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    </FormItem>
                  )}
                />
                {error && (
                  <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="group relative">
                  <div className="absolute -inset-px rounded-md bg-gradient-to-r from-[hsl(195_90%_55%)] to-[hsl(210_90%_50%)] opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-60" />
                  <Button
                    type="submit"
                    className="relative h-11 w-full text-sm font-semibold"
                    disabled={credentialsForm.formState.isSubmitting}
                  >
                    {credentialsForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...totpForm}>
              <form
                onSubmit={totpForm.handleSubmit(onSubmitTotp)}
                className="space-y-5"
                noValidate
              >
                <FormField
                  control={totpForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Authenticator code
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          className="h-11 font-mono tracking-[0.4em]"
                          placeholder="123456"
                          autoFocus
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && (
                  <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  className="h-11 w-full text-sm font-semibold"
                  disabled={totpForm.formState.isSubmitting}
                >
                  {totpForm.formState.isSubmitting ? "Verifying…" : "Verify"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStage("credentials");
                    totpForm.reset({ token: "" });
                    setError(null);
                  }}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              </form>
            </Form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Need access? Talk to your HR admin.
          </p>
        </div>
      </main>
    </div>
  );
}
