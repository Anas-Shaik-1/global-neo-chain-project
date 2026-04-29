import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
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
import { RequestResetSchema, type RequestResetValues } from "../schemas";
import { AuthShell } from "../components/AuthShell";

export function RequestResetPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const form = useForm<RequestResetValues>({
    resolver: zodResolver(RequestResetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: RequestResetValues) {
    try {
      await getApi().post("/auth/password-reset/request", { email: values.email });
    } finally {
      // Always show the same friendly message — we don't reveal whether the
      // email is known to avoid account-enumeration leaks.
      toast.success("If that email exists in our system, we've sent reset instructions.");
      setSubmittedEmail(values.email);
      setSubmitted(true);
    }
  }

  function handleSendAnother() {
    setSubmitted(false);
    setSubmittedEmail("");
    form.reset({ email: "" });
  }

  return (
    <AuthShell
      hero={{
        eyebrow: "Account recovery",
        title: (
          <>
            Lost your{" "}
            <span className="bg-gradient-to-r from-[hsl(195_90%_60%)] to-[hsl(210_90%_55%)] bg-clip-text text-transparent">
              way?
            </span>
          </>
        ),
        subtitle:
          "Drop your work email and we'll send a reset link. No drama.",
        pills: ["Token-based · expires in 1 hour"],
      }}
    >
      <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {submitted ? "Check your email" : "Forgot your password?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {submitted ? (
            <>
              If we have an account for <span className="font-medium text-foreground">{submittedEmail}</span>,
              the reset link is on its way.
            </>
          ) : (
            <>Enter your work email and we&rsquo;ll send a reset link.</>
          )}
        </p>
      </div>

      {submitted ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
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
            <p className="text-center text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Reset email dispatched
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full text-sm font-semibold"
              onClick={handleSendAnother}
            >
              Send another
            </Button>
            <Button
              asChild
              type="button"
              className="h-11 w-full text-sm font-semibold"
            >
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      ) : (
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
            <Button
              type="submit"
              className="h-11 w-full text-sm font-semibold"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </Form>
      )}

      {!submitted && (
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        <span className="font-mono opacity-60">DEV NOTE</span> · email currently logged to backend console
      </p>
    </AuthShell>
  );
}
