import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAppSelector } from "@/app/hooks";
import { Button } from "@/components/ui/button";
import { useResendVerification } from "@/features/auth/api/hooks";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();
  const resendVerification = useResendVerification();

  // Force-change-password gate: if the backend told us the user must change
  // their password, lock them out of every other route until they do. We allow
  // /change-password itself so the form can render.
  if (user?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  const showVerifyBanner = !!user && user.isVerified === false;

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {showVerifyBanner && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 lg:px-6">
            <div className="mx-auto flex max-w-7xl items-center gap-3 text-sm">
              <AlertTriangle
                aria-hidden
                className="h-4 w-4 shrink-0 text-amber-500"
              />
              <span className="flex-1 text-amber-200">
                Your email isn&rsquo;t verified yet. Check your inbox for a link.
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resendVerification.mutate()}
                disabled={resendVerification.isPending}
              >
                {resendVerification.isPending ? "Sending…" : "Resend"}
              </Button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
