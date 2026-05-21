import axios from "axios";
import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Zoho-branded social-auth button. Initiates the OAuth flow by redirecting
 * the browser to the backend's /auth/zoho/start handler, which sets a state
 * cookie and forwards to Zoho's authorize page. Same component is used on
 * both the login and register pages — the verb on the label is the only
 * difference (`mode="signin"` → "Continue with Zoho" / `"signup"` →
 * "Sign up with Zoho").
 *
 * Renders nothing until /auth/providers reports that Zoho is configured on
 * the backend. Avoids surfacing a non-functional button in tenants where
 * Zoho credentials haven't been provisioned. Result is cached so mounting
 * the button on both login + register pages doesn't refire the request.
 */
export function ZohoSignInButton({
  mode = "signin",
}: {
  mode?: "signin" | "signup";
}) {
  const { data: enabled = false } = useQuery({
    queryKey: ["auth", "providers", "zoho"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/auth/providers`);
      return Boolean(res.data?.zoho);
    },
    // Provider discovery is best-effort; on failure, hide the button
    // rather than render a broken affordance.
    retry: false,
    staleTime: Infinity,
  });

  if (!enabled) return null;

  const label = mode === "signup" ? "Sign up with Zoho" : "Continue with Zoho";

  function startOAuth() {
    // Top-level navigation so cookies + state survive the round-trip.
    window.location.href = `${API_BASE}/auth/zoho/start`;
  }

  return (
    <button
      type="button"
      onClick={startOAuth}
      className="group relative flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border/70 bg-card/40 px-4 text-sm font-semibold text-foreground/90 outline-none transition-colors hover:border-[hsl(214_96%_55%)] hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-[hsl(214_96%_55%)]"
    >
      <ZohoMark className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Inline SVG mark — uses Zoho's "Z" device colours to keep the button
 * visually identifiable without bundling a binary asset.
 */
function ZohoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top blue triangle wedge */}
      <path d="M14 14 L52 14 L52 26 L26 26 Z" fill="hsl(214 96% 55%)" />
      {/* Bottom red triangle wedge */}
      <path d="M14 50 L14 38 L40 38 L52 50 Z" fill="hsl(2 79% 56%)" />
      {/* Yellow Z stroke */}
      <path
        d="M14 26 L52 26 L14 50 L52 50"
        fill="none"
        stroke="hsl(45 92% 53%)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
