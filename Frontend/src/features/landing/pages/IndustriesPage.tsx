import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Building2,
  Droplets,
  Flame,
  GlassWater,
  Hotel,
  ShoppingCart,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell, SectionHeading } from "../components/MarketingChrome";
import { ServiceVisual, type Topic } from "../components/ServiceVisual";

interface Industry {
  id: Topic;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  Icon: LucideIcon;
  featured?: boolean;
}

/** Order: Oil & energy and E-commerce are featured (the user-stated focus
 *  industries), then everything else. */
const INDUSTRIES: Industry[] = [
  {
    id: "oil",
    eyebrow: "Featured",
    title: "Oil & energy",
    body: "From upstream sensor data to downstream retail, we build the AI, IoT, and operations software that keeps energy assets running. Predictive maintenance, drilling analytics, supply-chain visibility, and field-ops mobile apps for engineers on rigs and refineries.",
    bullets: [
      "Predictive maintenance for rotating equipment",
      "Sensor / SCADA data pipelines into time-series stores",
      "Field-ops apps for engineers on remote sites",
      "HSE & compliance dashboards",
    ],
    Icon: Flame,
    featured: true,
  },
  {
    id: "ecommerce",
    eyebrow: "Featured",
    title: "E-commerce",
    body: "Custom storefronts, payment integrations, inventory and order systems, and the AI behind recommendation, search, and fraud detection. Built to handle Black-Friday-grade traffic on day one.",
    bullets: [
      "Headless storefronts (Next.js / Shopify Hydrogen)",
      "Payment gateway integrations & subscription billing",
      "Recommendation, search, and pricing models",
      "Inventory, fulfilment, and returns workflows",
    ],
    Icon: ShoppingCart,
    featured: true,
  },
  {
    id: "logistics",
    eyebrow: "Industry",
    title: "Logistics & cold storage",
    body: "Real-time visibility on inbound/outbound shipments, attendance for shift workers across multiple sites, and audit-grade timestamping for cold-chain compliance.",
    bullets: [
      "Fleet & route tracking",
      "Cold-chain temperature audit trails",
      "Multi-site attendance & shift planning",
    ],
    Icon: Truck,
  },
  {
    id: "construction",
    eyebrow: "Industry",
    title: "Construction & contracting",
    body: "Project boards for site supervisors, multi-site attendance, expense reimbursement with receipt capture, and payslip PDFs for crews paid by the project.",
    bullets: [
      "Site-level cost & timeline dashboards",
      "Multi-project payroll & expenses",
      "Crew attendance with geo-stamping",
    ],
    Icon: Building2,
  },
  {
    id: "fashion",
    eyebrow: "Industry",
    title: "Fashion & retail",
    body: "Photo-first profiles for in-store staff, group chat per store, attendance with location tagging, and lightweight task boards for collection launches.",
    bullets: [
      "Per-store group chat & briefings",
      "Visual merchandising checklists",
      "Collection-launch task boards",
    ],
    Icon: Sparkles,
  },
  {
    id: "hospitality",
    eyebrow: "Industry",
    title: "Hospitality",
    body: "Shift-based attendance with auto-midnight close, group calls for daily briefings across properties, and HR-approved onboarding for seasonal hires.",
    bullets: [
      "Shift attendance & auto-midnight close",
      "Daily group call briefings",
      "Seasonal HR onboarding pipeline",
    ],
    Icon: Hotel,
  },
  {
    id: "beverages",
    eyebrow: "Industry",
    title: "Beverages & FMCG",
    body: "Field-sales attendance, expense submissions with receipt photos, and a shared task board between back-office and on-route teams.",
    bullets: [
      "Field-sales attendance",
      "Receipt-photo expense flow",
      "On-route + back-office task board",
    ],
    Icon: GlassWater,
  },
  {
    id: "fragrance",
    eyebrow: "Industry",
    title: "Fragrance & beauty",
    body: "Brand-safe profile photos, quick onboarding for retail staff, and a chat-first workspace that runs comfortably on phones.",
    bullets: [
      "Brand-safe staff profiles",
      "Mobile-first chat workspace",
      "Quick retail onboarding",
    ],
    Icon: Droplets,
  },
  {
    id: "asset-ops",
    eyebrow: "Industry",
    title: "Asset operations & B2B",
    body: "Bug tracker for internal tools, kanban for ops sprints, and audit-ready logs across attendance, payroll, and approvals.",
    bullets: [
      "Internal-tools bug tracker",
      "Ops sprint kanban",
      "Audit-ready approval logs",
    ],
    Icon: Boxes,
  },
];

function IndustryCard({ it }: { it: Industry }) {
  const { Icon } = it;
  return (
    <article
      id={it.id}
      className={`group relative scroll-mt-24 overflow-hidden rounded-3xl border bg-[#1a1338]/60 p-5 transition-colors hover:border-white/20 sm:p-6 ${
        it.featured
          ? "border-[hsl(258_85%_75%/0.35)] shadow-[0_20px_60px_-30px_hsl(258_80%_60%/0.45)]"
          : "border-white/10"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[hsl(258_75%_60%/0.15)] blur-2xl"
      />
      <ServiceVisual topic={it.id} alt={it.title} aspect="aspect-[16/9]" />
      <div className="relative px-2 pt-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#0d0820]">
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
      </div>
    </article>
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
                <span className="bg-gradient-to-r from-[hsl(258_90%_75%)] to-[hsl(270_75%_60%)] bg-clip-text text-transparent">
                  oil, e-commerce, and beyond.
                </span>
              </>
            }
            subtitle="Two focus verticals, plus a working roster of industries where our software is in production today. Each one shapes what we build, but the engineering bench is the same."
          />
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-12 sm:px-8 lg:px-12">
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
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8 lg:px-12">
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

        <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.18)] via-[hsl(258_50%_25%/0.2)] to-[#0d0820] p-10 text-center sm:p-14">
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
              className="rounded-full bg-[hsl(258_75%_60%)] px-7 font-semibold text-white shadow-[0_12px_30px_-10px_hsl(258_75%_60%/0.6)] hover:bg-[hsl(258_75%_55%)]"
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
