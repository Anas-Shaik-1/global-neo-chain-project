import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Circle } from "lucide-react";
import { getApi } from "@/api/axios";
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
import { ResetPasswordSchema, type ResetPasswordValues } from "../schemas";
import { AuthShell } from "../components/AuthShell";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { newPassword: "", confirm: "" },
  });

  // Hooks must run before any early-return.
  const password = form.watch("newPassword") ?? "";
  const rules = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
  ];
  const allOk = rules.every((r) => r.ok);

  if (!token) return <Navigate to="/forgot-password" replace />;

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);
    try {
      await getApi().post("/auth/password-reset/confirm", {
        token,
        newPassword: values.newPassword,
      });
      toast.success("Password updated. Sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      let message = "Reset failed. The link may have expired.";
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        if (data?.message) message = data.message;
      }
      setError(message);
    }
  }

  return (
    <AuthShell
      hero={{
        eyebrow: "Password reset",
        title: (
          <>
            Set a{" "}
            <span className="bg-gradient-to-r from-[hsl(195_90%_60%)] to-[hsl(210_90%_55%)] bg-clip-text text-transparent">
              fresh one.
            </span>
          </>
        ),
        subtitle:
          "Pick something memorable but not guessable. We'll keep the strength check honest as you type.",
        pills: ["Token expires in 1 hour", "Min 8 characters"],
      }}
    >
      <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Choose a new password
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick something at least 8 characters long, with upper, lower and a number.
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
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  New password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Live password strength rules */}
          <ul className="space-y-1.5 rounded-md border border-border/40 bg-muted/20 px-3 py-2.5 text-xs">
            {rules.map((r) => (
              <li key={r.label} className="flex items-center gap-2">
                {r.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" strokeWidth={1.75} />
                )}
                <span
                  className={
                    r.ok
                      ? "text-foreground transition-colors"
                      : "text-muted-foreground transition-colors"
                  }
                >
                  {r.label}
                </span>
              </li>
            ))}
          </ul>

          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Confirm new password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="h-11"
                    {...field}
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
            disabled={form.formState.isSubmitting || !allOk}
          >
            {form.formState.isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
