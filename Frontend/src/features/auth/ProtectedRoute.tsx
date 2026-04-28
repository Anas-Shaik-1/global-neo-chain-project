import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { useBootstrapSession } from "./useBootstrapSession";
import type { Role } from "./authSlice";

interface Props {
  roles?: Role[];
}

export function ProtectedRoute({ roles }: Props) {
  const status = useBootstrapSession();
  const user = useAppSelector((s) => s.auth.user);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        403 — You do not have access to this page.
      </div>
    );
  }

  return <Outlet />;
}
