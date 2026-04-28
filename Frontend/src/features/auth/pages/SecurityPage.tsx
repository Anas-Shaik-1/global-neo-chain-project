import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ShieldCheck, KeyRound } from "lucide-react";
import { getApi } from "@/api/axios";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { sessionEstablished } from "@/features/auth/authSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePw, setDisablePw] = useState("");
  const [disableErr, setDisableErr] = useState<string | null>(null);
  const [disableBusy, setDisableBusy] = useState(false);

  if (!user) return null;
  const totpEnabled = user.totpEnabled === true;

  async function openSetup() {
    setSetupOpen(true);
    setSetupLoading(true);
    setVerifyError(null);
    setVerifyToken("");
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

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    setVerifyBusy(true);
    try {
      await getApi().post("/auth/2fa/verify", { token: verifyToken });
      toast.success("Two-factor authentication enabled.");
      if (user && accessToken) {
        dispatch(sessionEstablished({ accessToken, user: { ...user, totpEnabled: true } }));
      }
      setSetupOpen(false);
      setSetupData(null);
      setVerifyToken("");
    } catch (err) {
      let message = "Invalid code. Try again.";
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        if (data?.message) message = data.message;
      }
      setVerifyError(message);
    } finally {
      setVerifyBusy(false);
    }
  }

  async function onDisable(e: FormEvent) {
    e.preventDefault();
    setDisableErr(null);
    setDisableBusy(true);
    try {
      await getApi().post("/auth/2fa/disable", { password: disablePw });
      toast.success("Two-factor authentication disabled.");
      if (user && accessToken) {
        dispatch(sessionEstablished({ accessToken, user: { ...user, totpEnabled: false } }));
      }
      setDisableOpen(false);
      setDisablePw("");
    } catch (err) {
      let message = "Could not disable 2FA.";
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        if (data?.message) message = data.message;
      }
      setDisableErr(message);
    } finally {
      setDisableBusy(false);
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
            setVerifyToken("");
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
            <form onSubmit={onVerify} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="totp">6-digit code</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono tracking-[0.4em]"
                  autoFocus
                />
              </div>
              {verifyError && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {verifyError}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSetupOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={verifyBusy || verifyToken.length !== 6}>
                  {verifyBusy ? "Verifying…" : "Enable 2FA"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={disableOpen}
        onOpenChange={(o) => {
          setDisableOpen(o);
          if (!o) {
            setDisablePw("");
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
          <form onSubmit={onDisable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-pw">Password</Label>
              <Input
                id="disable-pw"
                type="password"
                autoComplete="current-password"
                required
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
              />
            </div>
            {disableErr && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {disableErr}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisableOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={disableBusy}>
                {disableBusy ? "Disabling…" : "Disable 2FA"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
