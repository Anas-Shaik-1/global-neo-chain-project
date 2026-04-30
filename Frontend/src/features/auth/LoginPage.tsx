import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { loginThunk, login2FAThunk } from "./authThunks";
import {
  Login2FASchema,
  LoginSchema,
  type Login2FAValues,
  type LoginValues,
} from "./schemas";
import { AuthShell } from "./components/AuthShell";
import { TotpInput } from "./components/TotpInput";

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
      login2FAThunk({
        email: credentials.email,
        password: credentials.password,
        token: values.token,
      }),
    );
    if (action.type.endsWith("/rejected")) {
      setError((action.payload as string) ?? "Login failed");
    }
  }

  return (
    <AuthShell
      hero={{
        eyebrow: "Global NeoChain EMS",
        title: (
          <>
            Run your people ops with{" "}
            <span className="bg-gradient-to-r from-[hsl(195_90%_60%)] to-[hsl(210_90%_55%)] bg-clip-text text-transparent">
              quiet confidence.
            </span>
          </>
        ),
        subtitle:
          "The unified workspace for HR, finance and managers at Global NeoChain — directory, attendance, tasks, expenses and payroll in one calm place.",
        pills: FEATURE_PILLS,
      }}
    >
      <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
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
            className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both"
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
                    <PasswordInput
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
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <div className="group relative animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
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
            className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both"
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
                    <TotpInput
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
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
    </AuthShell>
  );
}
