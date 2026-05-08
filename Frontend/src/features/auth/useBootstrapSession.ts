import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { bootstrapSessionThunk } from "./authThunks";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useBootstrapSession(): SessionStatus {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [status, setStatus] = useState<SessionStatus>(user ? "authenticated" : "loading");
  // React 18+ StrictMode invokes effects twice on mount in dev. Without this
  // guard we'd fire two `/auth/me` requests at every cold start.
  const dispatched = useRef(false);

  useEffect(() => {
    if (user) {
      setStatus("authenticated");
      return;
    }
    if (dispatched.current) return;
    dispatched.current = true;
    let cancelled = false;
    dispatch(bootstrapSessionThunk()).then((action) => {
      if (cancelled) return;
      setStatus(action.type.endsWith("/fulfilled") ? "authenticated" : "unauthenticated");
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, user]);

  return status;
}
