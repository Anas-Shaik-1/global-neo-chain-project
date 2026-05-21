import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, MailCheck, Search, Upload, X } from "lucide-react";
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
import { useAppSelector } from "@/app/hooks";
import { AuthShell } from "../components/AuthShell";
import { ZohoSignInButton } from "../components/ZohoSignInButton";
import { useRegister, useRegistrationStatus, type ApprovalStatus } from "../api/hooks";
import {
  RegisterSchema,
  RegistrationStatusCheckSchema,
  type RegisterValues,
  type RegistrationStatusCheckValues,
} from "../schemas";

const STATUS_COPY: Record<ApprovalStatus, { label: string; tone: string; hint: string }> = {
  PENDING_HR: {
    label: "Awaiting HR review",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    hint: "Our HR team is taking a first look. You'll hear back soon.",
  },
  PENDING_ADMIN: {
    label: "HR approved · Awaiting Admin",
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    hint: "HR signed off. An Admin will give the final approval shortly.",
  },
  ACTIVE: {
    label: "Approved",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    hint: "Your account is active — sign in to get started.",
  },
  REJECTED: {
    label: "Not approved",
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
    hint: "Your application was not approved. Reach out to HR for details.",
  },
};

export function RegisterPage() {
  const user = useAppSelector((s) => s.auth.user);
  const register = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
      phone: "",
      // Avatar is required; we leave it undefined initially so the resolver
      // surfaces the "Profile picture is required" message on submit.
      avatar: undefined as unknown as File,
    },
  });

  // Hooks must run before any early-return.
  const password = form.watch("password") ?? "";
  const rules = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
  ];
  const allOk = rules.every((r) => r.ok);

  if (user) return <Navigate to="/dashboard" replace />;

  function onSubmit(values: RegisterValues) {
    setServerError(null);
    register.mutate(
      {
        email: values.email,
        name: values.name,
        password: values.password,
        phone: values.phone || undefined,
        avatar: values.avatar,
      },
      {
        onSuccess: (res) => setSubmittedEmail(res.email),
        onError: (err) => {
          let msg = "Registration failed. Please try again.";
          if (axios.isAxiosError(err)) {
            const data = err.response?.data as { message?: string } | undefined;
            if (data?.message) msg = data.message;
          }
          setServerError(msg);
        },
      },
    );
  }

  return (
    <AuthShell
      hero={{
        eyebrow: "Join Global NeoChain",
        title: (
          <>
            Join your team in{" "}
            <span className="bg-gradient-to-r from-[hsl(195_90%_60%)] to-[hsl(210_90%_55%)] bg-clip-text text-transparent">
              minutes.
            </span>
          </>
        ),
        subtitle:
          "Self-register your account, HR + Admin will sign off, and you'll be in. We'll keep you posted along the way.",
        pills: ["HR review", "Admin approval", "Email verification"],
      }}
    >
      {submittedEmail ? (
        <SubmittedState email={submittedEmail} />
      ) : (
        <>
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Create your account
            </h2>
            <p className="text-sm text-muted-foreground">
              Tell us who you are. Your account is reviewed by HR and an Admin before it goes live.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both"
              noValidate
            >
              <FormField
                control={form.control}
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
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Full name
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        className="h-11"
                        placeholder="Alex Morgan"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Profile picture
                    </FormLabel>
                    <FormControl>
                      <AvatarPicker
                        value={field.value as File | undefined}
                        onChange={(f) => field.onChange(f)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        className="h-11"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ul className="space-y-1.5 rounded-md border border-border/40 bg-muted/20 px-3 py-2.5 text-xs">
                {rules.map((r) => (
                  <li key={r.label} className="flex items-center gap-2">
                    {r.ok ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" strokeWidth={1.75} />
                    )}
                    <span className={r.ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                  </li>
                ))}
              </ul>

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Confirm password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        className="h-11"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Phone <span className="text-muted-foreground/60 normal-case">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-3 select-none text-sm font-medium text-muted-foreground">
                          +91
                        </span>
                        <Input
                          autoComplete="tel-national"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="9876543210"
                          className="h-11 pl-12"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {serverError}
                </div>
              )}

              <div className="group relative animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
                <div className="absolute -inset-px rounded-md bg-gradient-to-r from-[hsl(195_90%_55%)] to-[hsl(210_90%_50%)] opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-60" />
                <Button
                  type="submit"
                  className="relative h-11 w-full text-sm font-semibold"
                  disabled={register.isPending || form.formState.isSubmitting || !allOk}
                >
                  {register.isPending ? "Submitting…" : "Submit application"}
                </Button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-border/50" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
                  or
                </span>
                <span className="h-px flex-1 bg-border/50" />
              </div>

              <ZohoSignInButton mode="signup" />
            </form>
          </Form>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

/**
 * Inline avatar picker for the registration form. Uses an object URL for
 * preview and revokes it when the file changes / component unmounts so we
 * don't leak blob URLs.
 */
function AvatarPicker({
  value,
  onChange,
}: {
  value: File | undefined;
  onChange: (file: File | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-border/60 bg-muted/30 transition-colors hover:border-primary/60 hover:bg-primary/5"
        aria-label={value ? "Change profile picture" : "Upload profile picture"}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        )}
      </button>
      <div className="min-w-0 flex-1 text-xs">
        {value ? (
          <>
            <div className="truncate font-medium text-foreground">{value.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {(value.size / 1024).toFixed(0)} KB · {value.type.split("/")[1]?.toUpperCase()}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </>
        ) : (
          <div className="leading-snug text-muted-foreground">
            PNG, JPEG, WebP or GIF. Max 2 MB.
            <br />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 inline-flex font-medium text-primary hover:underline"
            >
              Choose a file
            </button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          onChange(f);
        }}
      />
    </div>
  );
}

function SubmittedState({ email }: { email: string }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <MailCheck className="h-6 w-6 text-emerald-400" strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Application submitted
        </h2>
        <p className="text-sm text-muted-foreground">
          We've notified HR. Your verification email will arrive after Admin approval — check
          your inbox once you're cleared.
        </p>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Submitted as</div>
        <div className="mt-1 font-mono text-foreground">{email}</div>
      </div>

      <StatusCheckPanel defaultEmail={email} />
    </div>
  );
}

/**
 * Inline panel that lets a user re-check where they are in the queue. The
 * email defaults to whatever they just submitted but they can change it (e.g.
 * if they registered yesterday and want to check today).
 */
function StatusCheckPanel({ defaultEmail }: { defaultEmail: string }) {
  const [submitted, setSubmitted] = useState<string | null>(defaultEmail);
  const status = useRegistrationStatus(submitted);

  const form = useForm<RegistrationStatusCheckValues>({
    resolver: zodResolver(RegistrationStatusCheckSchema),
    defaultValues: { email: defaultEmail },
  });

  function onCheck(values: RegistrationStatusCheckValues) {
    setSubmitted(values.email);
    void status.refetch();
  }

  const data = status.data;
  const copy = data ? STATUS_COPY[data.approvalStatus] : null;
  const errored =
    status.error && axios.isAxiosError(status.error) && status.error.response?.status === 404;

  return (
    <div className="space-y-3 rounded-md border border-border/40 bg-card/60 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Check status
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onCheck)} className="flex items-start gap-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@globalneochain.com"
                    className="h-9"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" variant="secondary" className="h-9">
            Check
          </Button>
        </form>
      </Form>

      {status.isFetching && (
        <p className="text-xs text-muted-foreground">Looking up your application…</p>
      )}
      {errored && (
        <p className="text-xs text-muted-foreground">No application found for that email.</p>
      )}
      {data && copy && (
        <div className={`rounded-md border px-3 py-2 text-xs ${copy.tone}`}>
          <div className="font-semibold">{copy.label}</div>
          <div className="mt-0.5 opacity-80">{copy.hint}</div>
        </div>
      )}
    </div>
  );
}
