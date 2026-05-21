import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell, SectionHeading } from "../components/MarketingChrome";
import { ServiceVisual } from "../components/ServiceVisual";
import { INDUSTRIES, type Industry } from "../data/industries";

function IndustryCard({ it }: { it: Industry }) {
  const { Icon } = it;
  return (
    <Link
      to={`/industries/${it.slug}`}
      id={it.id}
      className={`group relative block scroll-mt-24 overflow-hidden rounded-3xl border bg-[#0c1220]/60 p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_70px_-24px_hsl(258_80%_60%/0.4)] sm:p-6 ${
        it.featured
          ? "border-[hsl(258_85%_75%/0.35)] shadow-[0_20px_60px_-30px_hsl(258_80%_60%/0.45)]"
          : "border-white/10"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[hsl(258_75%_60%/0.15)] blur-2xl"
      />
      <ServiceVisual topic={it.id} image={it.image} alt={it.title} aspect="aspect-[16/9]" />
      <div className="relative px-2 pt-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#000000]">
            <Icon className="h-5 w-5 text-[hsl(258_85%_75%)]" />
          </div>
          <div
            className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${
              it.featured ? "text-[hsl(258_85%_75%)]" : "text-muted-foreground"
            }`}
          >
            {it.eyebrow}
          </div>
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight">
          {it.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {it.body}
        </p>
        <ul className="mt-5 space-y-2">
          {it.bullets.map((b) => (
            <li key={b} className="text-sm text-foreground/85">
              · {b}
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

export function IndustriesPage() {
  useEffect(() => {
    document.title = "Industries · Global NeoChain Solutions";
  }, []);

  const featured = INDUSTRIES.filter((i) => i.featured);
  const others = INDUSTRIES.filter((i) => !i.featured);

  return (
    <MarketingShell>
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-12 pt-16 sm:px-8 sm:pt-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="Industries we serve"
            title={
              <>
                Where we ship —{" "}
                <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
                  oil, e-commerce, and beyond.
                </span>
              </>
            }
            subtitle="Two focus verticals, plus a working roster of industries where our software is in production today. Each one shapes what we build, but the engineering bench is the same."
          />
        </div>
      </section>

      <nav
        aria-label="Focus industries"
        className="relative mx-auto w-full max-w-7xl px-6 pb-12 sm:px-8 lg:px-12"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="h-1 w-6 rounded-full bg-[hsl(258_85%_75%)]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(258_85%_75%)]">
            Focus industries
          </span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {featured.map((it) => (
            <IndustryCard key={it.id} it={it} />
          ))}
        </div>
      </nav>

      <nav
        aria-label="Other industries"
        className="relative mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8 lg:px-12"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="h-1 w-6 rounded-full bg-white/40" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Also active in
          </span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((it) => (
            <IndustryCard key={it.id} it={it} />
          ))}
        </div>

        <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.18)] via-[hsl(258_50%_25%/0.2)] to-[#000000] p-10 text-center sm:p-14">
          <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Don't see your industry?
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            That just means we haven't shipped there yet. Tell us what you're
            building and we'll tell you whether we're the right fit.
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
      </nav>
    </MarketingShell>
  );
}
