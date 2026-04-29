import type { ReactNode } from "react";
import { useAppSelector } from "@/app/hooks";
import type { Role } from "./authSlice";

interface Props {
  /** Allowed primary roles. If omitted, any authenticated role is allowed. */
  roles?: Role[];
  /**
   * If true, additionally require either Admin/HR (project-creation rights are
   * implicit on those roles) or an Employee with isProjectManager flipped on.
   */
  requirePM?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ roles, requirePM = false, fallback = null, children }: Props) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <>{fallback}</>;
  if (roles && !roles.includes(user.role)) return <>{fallback}</>;
  if (requirePM) {
    const elevated = user.role === "ADMIN" || user.role === "HR";
    if (!elevated && !user.isProjectManager) return <>{fallback}</>;
  }
  return <>{children}</>;
}
