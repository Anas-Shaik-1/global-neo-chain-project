import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAppSelector } from "@/app/hooks";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useResendVerification } from "@/features/auth/api/hooks";
import {
  connectChatSocket,
  disconnectChatSocket,
} from "@/features/chat/socket";
import { useNotificationsRealtime } from "@/features/notifications/api/hooks";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Top-level authenticated shell.
 *
 * Layout (top → bottom):
 *   ┌──────────────────────────────────────────┐
 *   │ Topbar (full width, brand + actions)     │  h-20 / 80px
 *   ├──────────────┬───────────────────────────┤
 *   │ Sidebar      │ Verify banner (optional)  │
 *   │              ├───────────────────────────┤
 *   │ (flat nav)   │ <main>  (only scroll)     │
 *   └──────────────┴───────────────────────────┘
 *
 * `<main>` is the single scroll surface to avoid Windows/Linux
 * dual-scrollbar bugs. `overflow-x-hidden` is explicit because
 * `overflow-y: auto` with default `overflow-x: visible` actually computes
 * to `overflow-x: auto`, silently introducing a horizontal scrollbar
 * whenever a child overflows.
 */
export function AppLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const location = useLocation();
  const resendVerification = useResendVerification();

  // Open the chat socket once for the whole authenticated session. The
  // chat namespace also doubles as our notifications push channel, so
  // we want it live regardless of whether the user is currently on the
  // /messages page. The socket reuses the singleton, so the messages
  // page calling connectChatSocket again is a no-op.
  useEffect(() => {
    if (!accessToken) return;
    connectChatSocket(accessToken);
    return () => {
      // We deliberately do NOT disconnect here when the route changes —
      // only when the user logs out (component unmounts at the auth gate).
      disconnectChatSocket();
    };
  }, [accessToken]);

  // Listen for `notification:new` and refresh the cache instantly.
  useNotificationsRealtime();

  if (user?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  const showVerifyBanner = !!user && user.isVerified === false;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Topbar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            {showVerifyBanner && (
              <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 lg:px-6">
                <div className="flex items-center gap-3 text-sm">
                  <AlertTriangle
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-amber-500"
                  />
                  <span className="flex-1 text-amber-200/90">
                    Your email isn&rsquo;t verified yet. Check your inbox for a link.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-200 hover:text-amber-100"
                    onClick={() => resendVerification.mutate()}
                    disabled={resendVerification.isPending}
                  >
                    {resendVerification.isPending ? "Sending…" : "Resend"}
                  </Button>
                </div>
              </div>
            )}
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
