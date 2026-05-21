import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, AlertOctagon } from "lucide-react";
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
import { ZohoSignInButton } from "./components/ZohoSignInButton";

const FEATURE_PILLS = [
  "Time tracking & approvals",
  "Payroll & expenses",
  "Directory & people ops",
  "Tasks · chat · calls",
];

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
        eyebrow: "GNC // OPS · LIVE",
        title: (
          <>
            Run your people ops with{" "}
            <span className="bg-gradient-to-br from-[hsl(195_90%_70%)] via-[hsl(195_90%_55%)] to-[hsl(210_90%_50%)] bg-clip-text text-transparent">
              quiet confidence.
            </span>
          </>
        ),
        subtitle:
          "The unified workspace for HR, finance, and managers at Global NeoChain — directory, attendance, tasks, expenses, and payroll, all on one calm console.",
        pills: FEATURE_PILLS,
      }}
    >

      <div className="space-y-3">
        <h2 className="font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-4xl">
          {stage === "credentials" ? (
            <>
              Welcome <span className="text-primary">back.</span>
            </>
          ) : (
            <>
              Two-<span className="text-primary">factor.</span>
            </>
          )}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {stage === "credentials"
            ? "Sign in to your Global NeoChain workspace."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {stage === "credentials" ? (
        <Form {...credentialsForm}>
          <form
            onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
            className="space-y-6"
            noValidate
          >
            <FormField
              control={credentialsForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    Work email
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@globalneochain.com"
                      className="h-11 rounded-md border border-border/70 bg-card/30 px-3.5 text-base shadow-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
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
                  <div className="flex items-baseline justify-between gap-3">
                    <FormLabel className="text-sm font-medium text-foreground">
                      Password
                    </FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <PasswordInput
                      autoComplete="current-password"
                      className="h-11 rounded-md border border-border/70 bg-card/30 px-3.5 text-base shadow-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && <ErrorBanner message={error} />}

            <SignInButton
              isPending={credentialsForm.formState.isSubmitting}
              label="Sign in"
            />

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border/50" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
                or
              </span>
              <span className="h-px flex-1 bg-border/50" />
            </div>

            <ZohoSignInButton mode="signin" />
          </form>
        </Form>
      ) : (
        <Form {...totpForm}>
          <form
            onSubmit={totpForm.handleSubmit(onSubmitTotp)}
            className="space-y-6"
            noValidate
          >
            <FormField
              control={totpForm.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
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

            {error && <ErrorBanner message={error} />}

            <SignInButton
              isPending={totpForm.formState.isSubmitting}
              label="Verify"
            />

            <button
              type="button"
              onClick={() => {
                setStage("credentials");
                totpForm.reset({ token: "" });
                setError(null);
              }}
              className="block w-full text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
            >
              ← back to sign in
            </button>
          </form>
        </Form>
      )}

      <div className="flex items-center gap-3 pt-2">
        <span className="h-px flex-1 bg-border/50" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
          new here?
        </span>
        <span className="h-px flex-1 bg-border/50" />
      </div>

      <Link
        to="/register"
        className="group flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-4 py-3 transition-all hover:border-primary/60 hover:bg-card/80"
      >
        <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground">
          Request access to your workspace
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
      </Link>
    </AuthShell>
  );
}

/**
 * Submit button with a hover-glow underlay and an arrow that translates on
 * hover — the single ceremony moment of the form.
 */
function SignInButton({ isPending, label }: { isPending: boolean; label: string }) {
  return (
    <div className="group relative">
      <div
        aria-hidden
        className="absolute -inset-px rounded-md bg-gradient-to-r from-[hsl(195_90%_55%)] via-[hsl(200_90%_50%)] to-[hsl(210_90%_50%)] opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70"
      />
      <Button
        type="submit"
        className="relative flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold tracking-tight"
        disabled={isPending}
      >
        <span>{isPending ? `${label.split(" ")[0]}…` : label}</span>
        {!isPending && (
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        )}
      </Button>
    </div>
  );
}

/**
 * Stamped-warning style error. Keeps `role="alert"` for tests and AT users,
 * but reads like a redacted ops log entry rather than a generic toast.
 */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="relative flex items-start gap-3 overflow-hidden rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5"
    >
      {/* Stripe accent on the left */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-destructive/70"
      />
      <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
      <div className="flex-1 space-y-0.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-destructive/80">
          err_auth · request rejected
        </div>
        <div className="text-sm text-destructive">{message}</div>
      </div>
    </div>
  );
}
