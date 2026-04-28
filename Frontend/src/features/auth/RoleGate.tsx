import type { ReactNode } from "react";
import { useAppSelector } from "@/app/hooks";
import type { Role } from "./authSlice";

interface Props {
  roles: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ roles, fallback = null, children }: Props) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <>{fallback}</>;
  if (!roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
