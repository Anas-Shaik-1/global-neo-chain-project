import type { ReactNode } from "react";
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
  { value: "98%", label: "uptime" },
  { value: "180+", label: "test coverage" },
  { value: "1.2s", label: "median load" },
];

/**
 * Shared chrome for all auth pages (login / forgot / reset).
 *
 * On mobile (<lg): the brand panel renders as a compact hero strip stacked
 * above the form panel — both share the same gradient-mesh atmosphere, so
 * there's no harsh seam between them.
 *
 * On lg+: 3:2 split panel — brand left, form right.
 */
export function AuthShell({ hero, kpis = DEFAULT_KPIS, children }: Props) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[3fr_2fr]">
      {/* === Brand panel — hero strip on mobile, full column on lg+ === */}
      <aside className="relative overflow-hidden bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Gradient mesh */}
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 15% 20%, hsla(195 90% 55% / 0.18) 0px, transparent 45%)",
              "radial-gradient(circle at 85% 75%, hsla(210 90% 50% / 0.20) 0px, transparent 50%)",
              "radial-gradient(circle at 60% 10%, hsla(195 90% 55% / 0.10) 0px, transparent 40%)",
            ].join(","),
          }}
        />
        {/* Dot grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        {/* Subtle vertical divider that fades — only on lg+ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-border/60 to-transparent lg:block"
        />

        <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-8 lg:gap-12 lg:p-0 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
          <div className="max-w-xl space-y-4 lg:space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {hero.eyebrow}
            </span>
            <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl xl:text-6xl">
              {hero.title}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              {hero.subtitle}
            </p>
          </div>

          {hero.pills && hero.pills.length > 0 && (
            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
              {hero.pills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur"
                >
                  {pill}
                </span>
              ))}
            </div>
          )}

          {/* KPI tiles — visible on lg+ only to keep the mobile hero compact */}
          {kpis.length > 0 && (
            <div className="hidden gap-3 lg:grid lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-md border border-border/40 bg-background/30 px-3 py-2 backdrop-blur"
                >
                  <div className="font-mono text-base font-semibold text-foreground/90">
                    {kpi.value}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom-left logo + © (lg only) */}
        <div className="relative z-10 hidden lg:flex lg:items-end lg:gap-3">
          <Logo showTagline={false} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            © 2026
          </span>
        </div>
      </aside>

      {/* === Form panel === */}
      <main className="relative flex flex-col items-center justify-center bg-background px-6 py-10 sm:px-10 lg:py-12">
        {/* Status pill top-right (lg only) */}
        <div className="absolute right-6 top-6 z-10 hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400 lg:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Status · Operational
        </div>

        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
          {children}

          {/* Decorative gradient line under the form (lg only) */}
          <div
            aria-hidden
            className="mx-auto hidden h-px w-2/5 bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block"
          />
        </div>

        {/* Bottom version line (lg only) */}
        <div className="absolute bottom-6 right-6 hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground lg:block">
          v1.0 · Global NeoChain
        </div>
      </main>
    </div>
  );
}
