import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell, SectionHeading } from "../components/MarketingChrome";
import { ServiceVisual } from "../components/ServiceVisual";
import { SERVICES, type ServiceGroup } from "../data/services";

function ServiceCard({ s }: { s: ServiceGroup }) {
  const { Icon } = s;
  return (
    <Link
      to={`/services/${s.slug}`}
      id={s.id}
      className="group relative block scroll-mt-24 overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/60 p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#181d27]/80 hover:shadow-[0_24px_70px_-24px_hsl(258_80%_60%/0.4)] sm:p-6"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br ${s.tone} blur-2xl`}
      />
      <ServiceVisual topic={s.id} image={s.image} alt={s.title} />
      <div className="relative px-2 pt-6 sm:px-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#000000]">
            <Icon className="h-4 w-4 text-[hsl(258_85%_75%)]" />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {s.eyebrow}
          </div>
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight">
          {s.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {s.body}
        </p>
        <ul className="mt-5 space-y-2">
          {s.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm">
              <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(258_85%_75%)]" />
              <span className="text-foreground/85">{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(258_85%_75%)] opacity-0 transition-opacity group-hover:opacity-100">
          Read the page <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

export function ServicesPage() {
  useEffect(() => {
    document.title = "Services · Global NeoChain Solutions";
  }, []);

  return (
    <MarketingShell>
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-12 pt-16 sm:px-8 sm:pt-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="What we build"
            title={
              <>
                Software, models, and infrastructure —{" "}
                <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
                  shipped end-to-end.
                </span>
              </>
            }
            subtitle="Six capabilities that overlap on most engagements. We staff a small, senior team per project so the people writing the code are the ones talking to you."
          />
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-2">
          {SERVICES.map((s) => (
            <ServiceCard key={s.id} s={s} />
          ))}
        </div>

        <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.18)] via-[hsl(258_50%_25%/0.2)] to-[#000000] p-10 text-center sm:p-14">
          <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Have a project in mind?
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Tell us what you're trying to build. We'll come back with scope,
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
              <Link to="/industries">Industries we serve</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
