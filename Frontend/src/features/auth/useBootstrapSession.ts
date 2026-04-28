import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { bootstrapSessionThunk } from "./authThunks";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useBootstrapSession(): SessionStatus {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [status, setStatus] = useState<SessionStatus>(user ? "authenticated" : "loading");

  useEffect(() => {
    if (user) {
      setStatus("authenticated");
      return;
    }
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
