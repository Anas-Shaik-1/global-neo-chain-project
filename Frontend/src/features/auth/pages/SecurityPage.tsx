import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, KeyRound } from "lucide-react";
import { getApi } from "@/api/axios";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { sessionEstablished } from "@/features/auth/authSlice";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/PageHeader";
import {
  TwoFactorDisableSchema,
  TwoFactorVerifySchema,
  type TwoFactorDisableValues,
  type TwoFactorVerifyValues,
} from "../schemas";

interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export function SecurityPage() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const user = auth.user;
  const accessToken = auth.accessToken;
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupData, setSetupData] = useState<TotpSetupResult | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableErr, setDisableErr] = useState<string | null>(null);

  const verifyForm = useForm<TwoFactorVerifyValues>({
    resolver: zodResolver(TwoFactorVerifySchema),
    defaultValues: { token: "" },
  });

  const disableForm = useForm<TwoFactorDisableValues>({
    resolver: zodResolver(TwoFactorDisableSchema),
    defaultValues: { password: "" },
  });

  if (!user) return null;
  const totpEnabled = user.totpEnabled === true;

  async function openSetup() {
    setSetupOpen(true);
    setSetupLoading(true);
    setVerifyError(null);
    verifyForm.reset({ token: "" });
    try {
      const res = await getApi().post<TotpSetupResult>("/auth/2fa/setup");
      setSetupData(res.data);
    } catch {
      toast.error("Could not start 2FA setup.");
      setSetupOpen(false);
    } finally {
      setSetupLoading(false);
    }
  }

  async function onVerify(values: TwoFactorVerifyValues) {
    setVerifyError(null);
    try {
      await getApi().post("/auth/2fa/verify", { token: values.token });
      toast.success("Two-factor authentication enabled.");
      if (user && accessToken) {
        dispatch(sessionEstablished({ accessToken, user: { ...user, totpEnabled: true } }));
      }
      setSetupOpen(false);
      setSetupData(null);
      verifyForm.reset({ token: "" });
    } catch (err) {
      let message = "Invalid code. Try again.";
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        if (data?.message) message = data.message;
      }
      setVerifyError(message);
    }
  }

  async function onDisable(values: TwoFactorDisableValues) {
    setDisableErr(null);
    try {
      await getApi().post("/auth/2fa/disable", { password: values.password });
      toast.success("Two-factor authentication disabled.");
      if (user && accessToken) {
        dispatch(sessionEstablished({ accessToken, user: { ...user, totpEnabled: false } }));
      }
      setDisableOpen(false);
      disableForm.reset({ password: "" });
    } catch (err) {
      let message = "Could not disable 2FA.";
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        if (data?.message) message = data.message;
      }
      setDisableErr(message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Security"
        description="Manage your password and two-factor authentication."
      />

      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <CardTitle>Change password</CardTitle>
            <CardDescription>Pick a new password for your account.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/change-password">Change password</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>
              {totpEnabled
                ? "Enabled — you'll be asked for a 6-digit code from your authenticator app at sign-in."
                : "Add an extra step at sign-in using an authenticator app."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {totpEnabled ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Enabled
              </span>
              <Button variant="outline" onClick={() => setDisableOpen(true)}>
                Disable
              </Button>
            </>
          ) : (
            <Button onClick={openSetup}>Set up 2FA</Button>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={setupOpen}
        onOpenChange={(o) => {
          setSetupOpen(o);
          if (!o) {
            setSetupData(null);
            verifyForm.reset({ token: "" });
            setVerifyError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy)
              and enter the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          {setupLoading || !setupData ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Form {...verifyForm}>
              <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-4" noValidate>
                <div className="flex justify-center">
                  <img
                    src={setupData.qrCodeDataUrl}
                    alt="2FA QR code"
                    className="h-48 w-48 rounded-md border border-border bg-white p-2"
                  />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">
                    Or enter the secret manually:
                  </p>
                  <code className="block break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
                    {setupData.secret}
                  </code>
                </div>
                <FormField
                  control={verifyForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>6-digit code</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          className="font-mono tracking-[0.4em]"
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
                {verifyError && (
                  <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {verifyError}
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSetupOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={verifyForm.formState.isSubmitting}>
                    {verifyForm.formState.isSubmitting ? "Verifying…" : "Enable 2FA"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={disableOpen}
        onOpenChange={(o) => {
          setDisableOpen(o);
          if (!o) {
            disableForm.reset({ password: "" });
            setDisableErr(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication</DialogTitle>
            <DialogDescription>
              Confirm your password to remove 2FA from your account.
            </DialogDescription>
          </DialogHeader>
          <Form {...disableForm}>
            <form onSubmit={disableForm.handleSubmit(onDisable)} className="space-y-4" noValidate>
              <FormField
                control={disableForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {disableErr && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {disableErr}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDisableOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={disableForm.formState.isSubmitting}
                >
                  {disableForm.formState.isSubmitting ? "Disabling…" : "Disable 2FA"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
