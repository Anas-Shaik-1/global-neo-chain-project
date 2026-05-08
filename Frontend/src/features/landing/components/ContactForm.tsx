import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApi } from "@/api/axios";

/**
 * Mirrors the backend Zod schema (Backend/src/modules/contact/contact.schema.ts).
 * Server is the source of truth; this just gives instant in-form validation.
 */
const ContactFormSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  company: z.string().trim().max(100).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "A few sentences please — minimum 10 characters")
    .max(4000),
  /** Honeypot — kept off-screen with `aria-hidden + position:absolute`. */
  website: z.string().max(200).optional(),
});
type ContactFormValues = z.infer<typeof ContactFormSchema>;

interface ApiError {
  response?: { data?: { message?: string; code?: string } };
  message?: string;
}

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: { name: "", email: "", company: "", message: "", website: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    setServerError(null);
    try {
      await getApi().post("/contact", {
        name: values.name,
        email: values.email,
        company: values.company,
        message: values.message,
        website: values.website,
      });
      setSubmitted(true);
      form.reset();
    } catch (err) {
      const e = err as ApiError;
      // Surface the backend's message if it's a known error (validation,
      // rate limit). Generic fallback otherwise so we don't leak internals.
      const code = e.response?.data?.code;
      if (code === "RATE_LIMITED") {
        setServerError(
          "Too many submissions from this network. Take a breath and try again in a few minutes.",
        );
      } else {
        setServerError(
          e.response?.data?.message ??
            "Something went wrong sending the message. Email hello@global-neochain.com instead and we'll pick it up.",
        );
      }
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
        <h3 className="mt-3 font-display text-xl font-bold tracking-tight">
          Message received.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Our founding team replies personally — usually within 48 hours. Watch
          your inbox at the address you provided.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-5 rounded-full border-white/15 bg-white/[0.02]"
          onClick={() => setSubmitted(false)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="rounded-2xl border border-white/10 bg-[#0d0820]/60 p-6 sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Your name"
          error={form.formState.errors.name?.message}
        >
          <Input
            {...form.register("name")}
            placeholder="Priya Sharma"
            autoComplete="name"
          />
        </Field>
        <Field
          label="Work email"
          error={form.formState.errors.email?.message}
        >
          <Input
            {...form.register("email")}
            type="email"
            placeholder="priya@yourcompany.com"
            autoComplete="email"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Company (optional)"
          error={form.formState.errors.company?.message}
        >
          <Input
            {...form.register("company")}
            placeholder="Your company"
            autoComplete="organization"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="What are you trying to build?"
          error={form.formState.errors.message?.message}
        >
          <Textarea
            {...form.register("message")}
            placeholder="A few sentences about the project, the timeline you have in mind, and any constraints we should know about."
            rows={5}
          />
        </Field>
      </div>

      {/* Honeypot — invisible to humans, irresistible to naive bots. We keep
          tabIndex={-1} + autoComplete="off" so accessible-tech users won't
          land here either. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...form.register("website")}
          />
        </label>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          We'll never share your email or use it for marketing.
        </p>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="rounded-full bg-[hsl(258_75%_60%)] px-6 font-semibold text-white shadow-[0_8px_24px_-8px_hsl(258_75%_60%/0.6)] hover:bg-[hsl(258_75%_55%)]"
        >
          {form.formState.isSubmitting ? "Sending…" : "Send message"}
          {!form.formState.isSubmitting && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/85">{label}</Label>
      {children}
      {error && (
        <div className="text-xs text-red-300">{error}</div>
      )}
    </div>
  );
}
