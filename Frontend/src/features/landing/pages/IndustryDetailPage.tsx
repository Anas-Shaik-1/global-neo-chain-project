import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "../components/MarketingChrome";
import { ServiceVisual } from "../components/ServiceVisual";
import {
  getIndustryBySlug,
  getRelatedIndustries,
} from "../data/industries";
import { SERVICES } from "../data/services";

export function IndustryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const industry = getIndustryBySlug(slug);

  useEffect(() => {
    if (industry) {
      document.title = `${industry.navLabel} · Industries · Global NeoChain Solutions`;
    }
  }, [industry]);

  if (!industry) return <Navigate to="/industries" replace />;

  const { Icon } = industry;
  const related = getRelatedIndustries(industry.slug);
  const linkedServices = SERVICES.filter((s) =>
    industry.relatedServices.includes(s.slug),
  );

  return (
    <MarketingShell>
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pt-10 sm:px-8 sm:pt-14 lg:px-12">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/industries"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            All industries
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
            {industry.eyebrow}
          </span>
        </div>
      </section>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both">
            <div className="inline-flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#000000]">
                <Icon className="h-5 w-5 text-[hsl(258_85%_75%)]" />
              </div>
              <div
                className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${
                  industry.featured
                    ? "text-[hsl(258_85%_75%)]"
                    : "text-muted-foreground"
                }`}
              >
                {industry.eyebrow}
              </div>
            </div>

            <h1 className="font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance text-foreground sm:text-[48px] lg:text-[56px]">
              <span className="block">{industry.title}</span>
              <span className="block bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
                Built for the work, not the brochure.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {industry.body}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[image:var(--gradient-brand)] px-7 font-semibold text-white shadow-[var(--shadow-cta)] transition-shadow hover:shadow-[var(--glow-purple)]"
              >
                <Link to="/#contact">
                  Talk to us
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-white/15 bg-white/[0.02] px-6 text-foreground hover:bg-white/5"
              >
                <Link to="/industries">All industries</Link>
              </Button>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150 fill-mode-both">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/60 p-3 shadow-2xl shadow-black/40 backdrop-blur sm:p-4">
              <ServiceVisual
                topic={industry.id}
                image={industry.image}
                alt={industry.title}
                aspect="aspect-[4/3]"
              />
            </div>
            <div
              aria-hidden
              className="absolute -inset-x-12 -bottom-12 -z-10 h-32 rounded-full bg-[hsl(258_80%_60%/0.3)] blur-3xl"
            />
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
              What we ship for {industry.navLabel.toLowerCase()}
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              The shortlist.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Everything below is something we've shipped — not a wish-list.
              Most engagements land on two or three of these.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {industry.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0c1220]/40 p-4 transition-colors hover:border-white/20 hover:bg-[#181d27]/60"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-sm leading-relaxed text-foreground/90">
                  {b}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Sample scenarios ───────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
            What it looks like in production
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three scenarios,{" "}
            <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
              from real engagements.
            </span>
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {industry.scenarios.map((s, i) => (
            <div
              key={s.title}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/60 p-6 transition-colors hover:border-white/20"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[hsl(258_75%_60%/0.18)] blur-2xl"
              />
              <div className="relative">
                <div className="font-display text-3xl font-black tabular-nums tracking-tight text-[hsl(258_85%_75%/0.6)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Linked services ────────────────────────────────────────────── */}
      {linkedServices.length > 0 && (
        <section className="relative mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/40 p-8 sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
                  Capabilities behind the work
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  The team you'd staff.
                </h3>
              </div>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-white/15 bg-white/[0.02] text-foreground hover:bg-white/5"
              >
                <Link to="/services">
                  All services <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {linkedServices.map((s) => {
                const SIcon = s.Icon;
                return (
                  <Link
                    key={s.slug}
                    to={`/services/${s.slug}`}
                    className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-[#000000]/60 p-4 transition-all hover:border-[hsl(258_85%_75%/0.4)] hover:bg-[#0c1220]/80"
                  >
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#000000] text-[hsl(258_85%_75%)]">
                      <SIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-bold tracking-tight text-foreground">
                        {s.navLabel}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {s.navHint}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-[hsl(258_85%_75%)]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Related industries ─────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
              You might also explore
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Other industries.
            </h2>
          </div>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-white/15 bg-white/[0.02] text-foreground hover:bg-white/5"
          >
            <Link to="/industries">
              All industries <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => {
            const RIcon = r.Icon;
            return (
              <Link
                key={r.slug}
                to={`/industries/${r.slug}`}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/60 p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#181d27]/80 hover:shadow-[0_20px_60px_-20px_hsl(258_80%_60%/0.35)]"
              >
                <ServiceVisual topic={r.id} image={r.image} alt={r.title} aspect="aspect-[16/9]" />
                <div className="px-2 pt-5">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#000000] text-[hsl(258_85%_75%)]">
                      <RIcon className="h-4 w-4" />
                    </div>
                    <div className="font-display text-base font-bold tracking-tight">
                      {r.navLabel}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {r.body}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-10 sm:px-8 lg:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.2)] via-[hsl(258_50%_25%/0.25)] to-[#000000] p-10 text-center sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[hsl(258_75%_60%/0.3)] blur-3xl"
          />
          <h3 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Building something for {industry.navLabel.toLowerCase()}?
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Share a few lines about your project. We'll come back with scope,
            timeline, and a team in 48 hours.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[image:var(--gradient-brand)] px-7 font-semibold text-white shadow-[var(--shadow-cta)] transition-shadow hover:shadow-[var(--glow-purple)]"
            >
              <Link to="/#contact">
                Talk to us
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-white/15 bg-white/[0.02] px-6 text-foreground hover:bg-white/5"
            >
              <Link to="/services">See our services</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
