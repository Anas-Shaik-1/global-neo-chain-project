import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";

interface HeroConfig {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  pills?: string[];
}

interface KPIItem {
  value: string;
  label: string;
}

interface Props {
  hero: HeroConfig;
  kpis?: KPIItem[];
  children: ReactNode;
}

const DEFAULT_KPIS: KPIItem[] = [
  { value: "98.7", label: "uptime · %" },
  { value: "237", label: "tests passing" },
  { value: "1.2", label: "median load · s" },
];

/**
 * Editorial × ops-console chrome shared by every auth page (login, register,
 * forgot, reset, verify-email).
 *
 * Aesthetic notes:
 *   • Hero typography uses the app's display family (Bricolage Grotesque)
 *     at large optical sizes for an editorial, confident first impression
 *     that still feels native to the rest of the workspace.
 *   • Mono "telemetry" margin: vertical coordinate strip on the brand panel
 *     spine + a live-clock console widget at the bottom. These reinforce that
 *     this is a *system*, not a marketing site.
 *   • Coordinate grid background with labelled tick marks (vs. the generic
 *     dot grid you see on every B2B login page).
 *   • Slow scan-line sweep + grain overlay add atmosphere without distraction.
 */
export function AuthShell({ hero, kpis = DEFAULT_KPIS, children }: Props) {
  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-[3fr_2fr]">
      {/* Page-wide grain overlay (data-URI SVG noise so we don't ship a binary) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* === Brand panel — magazine-cover hero === */}
      <aside className="relative overflow-hidden bg-card lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* Layered gradient mesh */}
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 18% 25%, hsla(195 90% 55% / 0.22) 0px, transparent 42%)",
              "radial-gradient(circle at 88% 78%, hsla(210 90% 50% / 0.24) 0px, transparent 48%)",
              "radial-gradient(circle at 55% 8%, hsla(195 90% 55% / 0.10) 0px, transparent 38%)",
              "linear-gradient(180deg, hsla(220 25% 4% / 0.0) 0%, hsla(220 25% 4% / 0.35) 100%)",
            ].join(","),
          }}
        />

        {/* Coordinate grid (labelled, not just dots) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        {/* Major tick marks at every 4th gridline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0 0, currentColor 1.5px, transparent 1.5px)",
            backgroundSize: "320px 320px",
          }}
        />

        {/* Slow scan-line sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -z-0 hidden h-32 lg:block"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, hsla(195 90% 55% / 0.08) 40%, hsla(195 90% 55% / 0.18) 50%, hsla(195 90% 55% / 0.08) 60%, transparent 100%)",
            animation: "auth-scan 9s linear infinite",
          }}
        />

        {/* Vertical spine of metadata (lg only) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-3 top-0 z-10 hidden h-full flex-col items-center justify-center gap-3 lg:flex"
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground/70"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            GNC · OPS · BERLIN · 52.520°N · 13.405°E
          </span>
        </div>
        {/* Subtle vertical divider that fades — only on lg+ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-border/60 to-transparent lg:block"
        />

        <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-8 lg:gap-14 lg:p-0 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both">
          {/* Telemetry eyebrow — replaces the generic "pill" */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 animate-auth-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {hero.eyebrow}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
              ·  signal nominal
            </span>
          </div>

          {/* Editorial headline — Bricolage at large optical sizes */}
          <div className="max-w-2xl space-y-5 lg:space-y-7">
            <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[56px] xl:text-[68px]">
              {hero.title}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {hero.subtitle}
            </p>
          </div>

          {/* Numbered capabilities (replaces flat pills) */}
          {hero.pills && hero.pills.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:max-w-md sm:grid-cols-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150 fill-mode-both">
              {hero.pills.map((pill, i) => (
                <li
                  key={pill}
                  className="group flex items-center gap-3 border-l border-border/50 pl-3 transition-colors hover:border-primary/60"
                >
                  <span className="font-mono text-[10px] tabular-nums text-primary/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[13px] font-medium tracking-tight text-foreground/85 transition-colors group-hover:text-foreground">
                    {pill}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Live console widget — pretends to be a real ops dashboard */}
          {kpis.length > 0 && (
            <ConsoleWidget kpis={kpis} />
          )}
        </div>

        {/* Footer: Logo + © */}
        <div className="relative z-10 hidden lg:flex lg:items-end lg:justify-between">
          <div className="flex items-end gap-3">
            <Logo showTagline={false} />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
              © 2026
            </span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
            ed. 01 · v1.0
          </div>
        </div>
      </aside>

      {/* === Form panel === */}
      <main className="relative flex flex-col items-center justify-center bg-background px-6 py-10 sm:px-10 lg:py-12">
        {/* Faint vertical guides flanking the form column (lg only) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-12 left-12 hidden w-px bg-gradient-to-b from-transparent via-border/40 to-transparent lg:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-12 right-12 hidden w-px bg-gradient-to-b from-transparent via-border/40 to-transparent lg:block"
        />

        {/* Status pill top-right (lg only) */}
        <div className="absolute right-6 top-6 z-10 hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400 lg:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          status · operational
        </div>

        <div className="relative z-10 w-full max-w-sm space-y-9 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
          {children}
        </div>

        {/* Decorative gradient line under the form (lg only) */}
        <div
          aria-hidden
          className="absolute bottom-20 left-1/2 hidden h-px w-2/5 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block"
        />

        {/* Bottom-left version + bottom-right edition */}
        <div className="absolute bottom-6 left-6 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 lg:flex">
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          encrypted channel · tls 1.3
        </div>
        <div className="absolute bottom-6 right-6 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 lg:block">
          v1.0 · global neochain
        </div>
      </main>
    </div>
  );
}

/**
 * Live console widget — a single tile of "operational" telemetry plus a
 * timestamp that updates each second. Purely cosmetic: it sells the editorial
 * × ops-console concept by behaving like a real dashboard would.
 */
function ConsoleWidget({ kpis }: { kpis: KPIItem[] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");

  return (
    <div className="hidden max-w-md overflow-hidden rounded-md border border-border/60 bg-background/40 backdrop-blur lg:block animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 fill-mode-both">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/60" />
          <span className="h-2 w-2 rounded-full bg-amber-500/60" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          gnc · live · {hh}:{mm}:<span className="text-primary/90">{ss}</span> utc
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {kpis.map((k) => (
          <div key={k.label} className="px-3 py-3">
            <div className="font-mono text-lg font-medium tabular-nums text-foreground">
              {k.value}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              {k.label}
            </div>
          </div>
        ))}
      </div>
      {/* Mini sparkline strip */}
      <div className="relative h-6 border-t border-border/60">
        <svg
          aria-hidden
          viewBox="0 0 200 24"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="auth-spark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(195 90% 55%)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(195 90% 55%)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,18 L12,14 L24,16 L36,9 L48,12 L60,7 L72,11 L84,5 L96,10 L108,8 L120,13 L132,6 L144,11 L156,4 L168,9 L180,7 L192,12 L200,8"
            fill="none"
            stroke="hsl(195 90% 55%)"
            strokeOpacity="0.7"
            strokeWidth="1"
          />
          <path
            d="M0,18 L12,14 L24,16 L36,9 L48,12 L60,7 L72,11 L84,5 L96,10 L108,8 L120,13 L132,6 L144,11 L156,4 L168,9 L180,7 L192,12 L200,8 L200,24 L0,24 Z"
            fill="url(#auth-spark)"
          />
        </svg>
      </div>
    </div>
  );
}
