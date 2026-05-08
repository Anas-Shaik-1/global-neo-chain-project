import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TotpInput } from "./TotpInput";
import {
  useRequestPhoneVerification,
  useConfirmPhoneVerification,
} from "../api/hooks";

const Schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
type Values = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  onVerified: () => void;
}

/**
 * Two-step dialog: "Send code" → enter 6-digit OTP → verify. The TotpInput
 * primitive is intentionally reused from the 2FA flow so the keyboard / paste
 * behaviour is identical (auto-advance, paste-to-fill, arrow-key navigation).
 */
export function PhoneOtpDialog({ open, onOpenChange, phone, onVerified }: Props) {
  const [sent, setSent] = useState(false);
  const request = useRequestPhoneVerification();
  const confirm = useConfirmPhoneVerification();

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { code: "" },
  });

  async function onSendCode() {
    await request.mutateAsync();
    setSent(true);
  }

  async function onSubmit(values: Values) {
    await confirm.mutateAsync({ code: values.code });
    onVerified();
    onOpenChange(false);
    setSent(false);
    form.reset({ code: "" });
  }

  // Reset internal state any time the dialog closes so the next open starts
  // at the "send code" step rather than showing a stale code box.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSent(false);
      form.reset({ code: "" });
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify your phone</DialogTitle>
          <DialogDescription>
            We&rsquo;ll send a 6-digit code to{" "}
            <span className="font-medium">{phone}</span>.
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below to receive your verification code via SMS.
            </p>
            <Button
              onClick={onSendCode}
              disabled={request.isPending}
              className="w-full"
            >
              {request.isPending ? "Sending…" : "Send code"}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification code</FormLabel>
                    <FormControl>
                      <TotpInput
                        value={field.value}
                        onChange={field.onChange}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onSendCode}
                  disabled={request.isPending}
                >
                  Resend
                </Button>
                <Button type="submit" disabled={confirm.isPending}>
                  {confirm.isPending ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
