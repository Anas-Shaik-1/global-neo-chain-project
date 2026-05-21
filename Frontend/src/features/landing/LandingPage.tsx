import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Cloud,
  Code2,
  CheckCircle2,
  Database,
  Flame,
  Layers,
  ShoppingCart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/app/hooks";
import {
  MarketingShell,
  SectionHeading,
} from "./components/MarketingChrome";
import { TeamAvatar } from "./components/TeamAvatar";
import { ServiceVisual, type Topic } from "./components/ServiceVisual";
import { ContactForm } from "./components/ContactForm";
import { LEADERSHIP, ENGINEERS } from "./data/team";

export function LandingPage() {
  const user = useAppSelector((s) => s.auth.user);
  if (user) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    document.title = "Global NeoChain Solutions — AI, full-stack, data, DevOps";
  }, []);

  return (
    <MarketingShell>
      <Hero />
      <Reveal><TrustedMarquee /></Reveal>
      <Reveal><ServicesPreview /></Reveal>
      <Reveal><IndustriesPreview /></Reveal>
      <Reveal><FlagshipProduct /></Reveal>
      <Reveal><TeamPreview /></Reveal>
      <Reveal><ContactCta /></Reveal>
    </MarketingShell>
  );
}

/**
 * Reveal — fades a section in with a small upward translate the first time
 * it intersects the viewport. CSS does the heavy lifting; this just toggles
 * `is-visible`. Stops observing after the first reveal so it never re-runs.
 */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            return;
          }
        }
      },
      // Trigger slightly before the section is fully in view so the reveal
      // feels timely rather than late.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div ref={ref} className={`reveal-on-scroll${shown ? " is-visible" : ""}`}>
      {children}
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-20 lg:px-12 lg:pt-24">
      <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-muted-foreground">
              Software studio · Oil & Energy · E-commerce
            </span>
          </div>

          <h1 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.025em] text-foreground text-balance sm:text-[52px] lg:text-[60px]">
            <span className="block">Engineering teams,</span>
            <span className="block bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
              shipping software
            </span>
            <span className="block text-foreground/95">your business runs on.</span>
          </h1>

          <p className="font-display text-lg font-semibold tracking-tight text-foreground/85 sm:text-xl">
            A startup, built by senior engineers.
          </p>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Global NeoChain Solutions partners with{" "}
            <span className="text-foreground/95">oil &amp; energy</span> and{" "}
            <span className="text-foreground/95">e-commerce</span> teams to
            ship the systems they actually need —{" "}
            <span className="text-foreground/95">AI &amp; ML models</span>,
            full-stack apps in{" "}
            <span className="text-foreground/95">MERN, Python, Java</span>,
            data &amp; analytics platforms, and the DevOps to keep all of it
            running. Senior bench, fixed scope, built to last.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[image:var(--gradient-brand)] px-7 font-semibold text-white shadow-[var(--shadow-cta)] transition-shadow hover:shadow-[var(--glow-purple)]"
            >
              <a href="#contact">
                Start a project
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-white/15 bg-white/[0.02] px-6 text-foreground hover:bg-white/5"
            >
              <Link to="/services">See what we build</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Senior engineers, no juniors-only squads
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Scope &amp; timeline back in 48 hours
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Talk to a human:{" "}
              <a
                href="mailto:hello@global-neochain.com"
                className="underline-offset-2 hover:underline"
              >
                hello@global-neochain.com
              </a>
            </span>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150 fill-mode-both">
      <div className="rounded-2xl border border-white/10 bg-[#0c1220]/80 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            workspace · sample view
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
          <PreviewMetric label="Active projects" value="14" />
          <PreviewMetric label="Models in prod" value="7" />
          <PreviewMetric label="Engineers" value="23" />
        </div>
        <div className="space-y-2.5 p-4">
          <PreviewLine tone="bg-emerald-500" text="Predictive-maintenance v2 deployed for ACME Oilfield" time="just now" />
          <PreviewLine tone="bg-cyan-500" text='Pricing model A/B test — uplift +4.2% on storefront' time="2m" />
          <PreviewLine tone="bg-amber-500" text="Data pipeline backfill complete (Snowflake)" time="14m" />
          <PreviewLine tone="bg-violet-500" text="Sprint review · 3 PRs merged" time="22m" />
        </div>
      </div>
      <div
        aria-hidden
        className="absolute -inset-x-12 -bottom-12 -z-10 h-32 rounded-full bg-[hsl(258_80%_60%/0.3)] blur-3xl"
      />
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3.5">
      <div className="font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PreviewLine({
  tone,
  text,
  time,
}: {
  tone: string;
  text: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />
      <span className="min-w-0 flex-1 truncate text-foreground/85">{text}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">{time}</span>
    </div>
  );
}

// ─── Continuous client marquee ──────────────────────────────────────────

interface Client {
  name: string;
  className: string;
}
const CLIENTS: Client[] = [
  { name: "LCK", className: "font-display text-2xl font-black tracking-[-0.04em]" },
  { name: "Fragrantly", className: "font-display text-2xl italic tracking-[0.04em]" },
  { name: "Dinode", className: "font-display text-2xl font-bold tracking-tight" },
  { name: "SehetMeyer", className: "font-display text-2xl font-bold tracking-[-0.02em]" },
  { name: "Harvish", className: "font-display text-2xl italic font-bold" },
  { name: "Purplepatch", className: "font-display text-2xl font-medium tracking-tight" },
  { name: "Zafra", className: "font-display text-2xl font-light uppercase tracking-[0.32em]" },
];

function TrustedMarquee() {
  // The track renders the client list TWICE so a -50% translateX wraps to a
  // seamless loop. CSS keyframes live in globals.css (animate-marquee-x).
  const items = [...CLIENTS, ...CLIENTS];

  return (
    <section className="relative mx-auto w-full max-w-7xl px-0 pb-6 pt-8 sm:pb-8 sm:pt-12">
      <div className="px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(258_85%_75%)]" />
            Trusted by customers worldwide
          </div>
          <h2 className="text-center font-display text-xl font-semibold tracking-tight text-foreground/90 sm:text-2xl">
            Teams shipping with Global NeoChain.
          </h2>
        </div>
      </div>

      <div className="relative mt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-6 h-24 bg-[hsl(258_75%_60%/0.18)] blur-3xl"
        />
        <div className="relative overflow-hidden border-y border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] py-7 backdrop-blur-sm sm:py-9">
          {/* Edge fades — make the wall feel infinite. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#000000] to-transparent sm:w-40"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#000000] to-transparent sm:w-40"
          />

          {/* The track. width:max-content + duplicated children + -50% */}
          <ul
            className="animate-marquee-x flex w-max items-center gap-x-2 sm:gap-x-3"
            // The animation is defined in globals.css — pause on hover and
            // honor prefers-reduced-motion. We don't keyframe inline so we
            // can keep cn-style classes for separators without React keys.
          >
            {items.map((c, i) => (
              <li
                key={`${c.name}-${i}`}
                className="group flex shrink-0 items-center"
                // aria-hide the duplicated half so screen readers don't
                // double-announce the brands.
                aria-hidden={i >= CLIENTS.length}
              >
                <span
                  title={c.name}
                  className={[
                    c.className,
                    "block px-6 text-foreground/60 transition-all duration-300",
                    "group-hover:-translate-y-0.5 group-hover:text-foreground",
                    "group-hover:[text-shadow:0_0_18px_hsl(258_85%_75%/0.45)]",
                    "sm:px-10",
                  ].join(" ")}
                >
                  {c.name}
                </span>
                <span aria-hidden className="hidden h-6 w-px bg-white/10 sm:block" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-xl px-6 text-center text-xs leading-relaxed text-muted-foreground/70 sm:px-8">
        Real teams, real workloads — across oil &amp; energy, e-commerce,
        logistics, fashion, hospitality and more.{" "}
        <a
          href="#contact"
          className="text-foreground/90 underline-offset-2 hover:underline"
        >
          Talk to us
        </a>
        .
      </p>
    </section>
  );
}

// ─── Services preview (links to /services) ──────────────────────────────

interface Capability {
  Icon: LucideIcon;
  topic: Topic;
  title: string;
  body: string;
  to: string;
  /** Real photo for the card visual. ServiceVisual falls back to its
   *  gradient placeholder if the URL fails to load. */
  image: string;
}
const CAPABILITIES: Capability[] = [
  {
    Icon: Bot,
    topic: "ai",
    title: "AI & ML models",
    body: "Predictive maintenance, fine-tuned LLMs, RAG over private corpora, and the MLOps to keep them honest.",
    to: "/services/ai",
    image:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1280&q=80&auto=format&fit=crop",
  },
  {
    Icon: Code2,
    topic: "fullstack",
    title: "Full-stack engineering",
    body: "Production apps in MERN, Python (FastAPI / Django), and Java (Spring Boot). Web, mobile, internal tools.",
    to: "/services/fullstack",
    image:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1280&q=80&auto=format&fit=crop",
  },
  {
    Icon: BarChart3,
    topic: "data",
    title: "Data & analytics",
    body: "ETL/ELT pipelines, warehouses, embedded dashboards, and self-serve analytics for decision-makers.",
    to: "/services/data",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1280&q=80&auto=format&fit=crop",
  },
  {
    Icon: Database,
    topic: "datascience",
    title: "Data science",
    body: "Forecasting, segmentation, causal inference — defensible numbers behind business decisions.",
    to: "/services/data-science",
    image:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1280&q=80&auto=format&fit=crop",
  },
  {
    Icon: Cloud,
    topic: "devops",
    title: "DevOps & cloud",
    body: "Kubernetes, Terraform, GitHub Actions, multi-cloud. Infra that doesn't wake your team up.",
    to: "/services/devops",
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1280&q=80&auto=format&fit=crop",
  },
  {
    Icon: Layers,
    topic: "products",
    title: "Product engineering",
    body: "0→1 MVPs in 6–10 weeks. Design systems, analytics, runbooks. Hand-off in working code.",
    to: "/services/products",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1280&q=80&auto=format&fit=crop",
  },
];

function ServicesPreview() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="What we build"
          title={
            <>
              Six capabilities,{" "}
              <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
                one senior team.
              </span>
            </>
          }
          subtitle="Most engagements span at least two of these. Click through for the full breakdown of each capability."
        />
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

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map(({ Icon, topic, title, body, to, image }) => (
          <Link
            key={title}
            to={to}
            className="card-sheen group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/60 p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#181d27]/80 hover:shadow-[0_20px_60px_-20px_hsl(258_80%_60%/0.35)]"
          >
            <ServiceVisual topic={topic} image={image} alt={title} aspect="aspect-[16/9]" />
            <div className="px-2 pt-5">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#000000] text-[hsl(258_85%_75%)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="font-display text-lg font-bold tracking-tight">
                  {title}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(258_85%_75%)] opacity-0 transition-opacity group-hover:opacity-100">
                Learn more <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Industries preview (Oil + E-commerce featured) ─────────────────────

function IndustriesPreview() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Industries we serve"
          title={
            <>
              Focused on{" "}
              <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
                oil & energy
              </span>{" "}
              and{" "}
              <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
                e-commerce
              </span>
              .
            </>
          }
          subtitle="Deep specialisation in two verticals — plus active engagements across logistics, retail, hospitality and more."
        />
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

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <FeaturedIndustryCard
          Icon={Flame}
          topic="oil"
          title="Oil & energy"
          body="Predictive maintenance for rotating equipment, sensor / SCADA pipelines into time-series stores, field-ops mobile apps for engineers on remote sites, HSE dashboards."
          to="/industries/oil"
          image="https://images.unsplash.com/photo-1611273426858-450e7620a915?w=1280&q=80&auto=format&fit=crop"
        />
        <FeaturedIndustryCard
          Icon={ShoppingCart}
          topic="ecommerce"
          title="E-commerce"
          body="Headless storefronts (Next.js / Shopify Hydrogen), payment & subscription billing, recommendation and search models, inventory and returns workflows."
          to="/industries/ecommerce"
          image="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1280&q=80&auto=format&fit=crop"
        />
      </div>
    </section>
  );
}

function FeaturedIndustryCard({
  Icon,
  topic,
  title,
  body,
  to,
  image,
}: {
  Icon: LucideIcon;
  topic: Topic;
  title: string;
  body: string;
  to: string;
  image?: string;
}) {
  return (
    <Link
      to={to}
      className="card-sheen group relative overflow-hidden rounded-3xl border border-[hsl(258_85%_75%/0.35)] bg-[#0c1220]/60 p-5 shadow-[0_20px_60px_-30px_hsl(258_80%_60%/0.45)] transition-all hover:-translate-y-0.5 hover:border-[hsl(258_85%_75%/0.6)] sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[hsl(258_75%_60%/0.18)] blur-2xl"
      />
      <ServiceVisual topic={topic} image={image} alt={title} aspect="aspect-[16/9]" />
      <div className="relative px-2 pt-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#000000] text-[hsl(258_85%_75%)]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="font-display text-2xl font-bold tracking-tight">
            {title}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(258_85%_75%)]">
          Read more <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

// ─── Flagship product (the EMS workspace) ───────────────────────────────

function FlagshipProduct() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(258_85%_75%)]">
            <Sparkles className="h-3 w-3" />
            Flagship product
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
            We don't just build for clients —{" "}
            <span className="bg-[image:var(--gradient-hero-text)] bg-clip-text text-transparent">
              we ship our own.
            </span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The workspace this site runs on is our own product —
            attendance, calendar, tasks, payroll, expenses, chat, calls, and
            a bug tracker. Used internally by our team, available to yours.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[image:var(--gradient-brand)] px-7 font-semibold text-white shadow-[var(--shadow-cta)] transition-shadow hover:shadow-[var(--glow-purple)]"
            >
              <Link to="/register">
                Try the workspace <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-white/15 bg-white/[0.02] px-6 text-foreground hover:bg-white/5"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-3">
          {[
            "People & directory",
            "Attendance",
            "Calendar & meetings",
            "Tasks & projects",
            "Chat & calls",
            "Expenses",
            "Payroll & payslips",
            "Bug tracker",
          ].map((label) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c1220]/40 px-4 py-3 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-foreground/90">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Team preview (links to /team) ──────────────────────────────────────

function TeamPreview() {
  // Show the leadership row + first half of engineers — gives 10 real
  // people on the landing without spilling out of the section. The full
  // 23-person roster lives on /team.
  const preview = [...LEADERSHIP, ...ENGINEERS.slice(0, 5)];
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/40 p-10 sm:p-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
              The team
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              23 engineers. One senior bench.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              No offshore handoffs, no junior-only squads. The people writing
              the code on your project are the ones you talk to in standup.
            </p>
            <div className="mt-6">
              <Button
                asChild
                className="rounded-full bg-[image:var(--gradient-brand)] px-6 font-semibold text-white shadow-[var(--shadow-cta)] transition-shadow hover:shadow-[var(--glow-purple)]"
              >
                <Link to="/team">
                  Meet the full team
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5">
            {preview.map((m) => (
              <Link
                key={m.name}
                to="/team"
                className="group flex flex-col items-center text-center"
                title={`${m.name} · ${m.role}`}
              >
                <TeamAvatar member={m} size="sm" />
                <div className="mt-2 line-clamp-1 text-xs font-semibold tracking-tight text-foreground/90">
                  {m.name.split(" ")[0]}
                </div>
                <div className="line-clamp-1 text-[10px] text-muted-foreground">
                  {m.role}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Contact CTA placeholder (real form is a follow-up step) ────────────

function ContactCta() {
  return (
    <section
      id="contact"
      className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-10 sm:px-8 lg:px-12"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.2)] via-[hsl(258_50%_25%/0.25)] to-[#000000] p-10 sm:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[hsl(258_75%_60%/0.3)] blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="space-y-4">
            <Users className="h-7 w-7 text-[hsl(258_85%_75%)]" />
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Tell us what you're building.
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground sm:text-base">
              Share a few lines about your project. Our founding team replies
              personally within 48 hours with scope, timeline, and the team
              we'd put on it.
            </p>
            <div className="space-y-1 pt-2 text-sm text-muted-foreground">
              <div>
                Email{" "}
                <a
                  href="mailto:hello@global-neochain.com"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  hello@global-neochain.com
                </a>
              </div>
              <div>
                Phone{" "}
                <a
                  href="tel:+918000000000"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  +91 80000 00000
                </a>
              </div>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
