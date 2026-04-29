import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { Logo } from "@/components/brand/Logo";
import { RequestResetSchema, type RequestResetValues } from "../schemas";

export function RequestResetPage() {
  const [submitted, setSubmitted] = useState(false);
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
      setSubmitted(true);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <Logo showTagline={false} />
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Forgot your password?
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter your work email and we&rsquo;ll send a reset link.
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <strong>MVP note:</strong> email delivery is logged to the server console
            only — production requires a real email provider.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
              disabled={form.formState.isSubmitting || submitted}
            >
              {form.formState.isSubmitting ? "Sending…" : submitted ? "Sent" : "Send reset link"}
            </Button>
          </form>
        </Form>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
