import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for every public marketing page (`/`, `/team`, `/services`,
 * `/industries`, `/about`). Wraps content with a pure-black canvas, the
 * top navigation, and the footer — modelled on www.globalneochain.com.
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-foreground">
      <BackgroundLayers />
      <Topbar />
      <main className="relative z-10">{children}</main>
      <FooterBar />
    </div>
  );
}

export function BackgroundLayers() {
  // Pure black canvas with two restrained blue radial accents plus a
  // whisper of grain. Matches the minimalist look of the production GNC
  // site — no violet wash, no diagonal gradient.
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            "radial-gradient(circle at 20% 10%, rgba(37, 99, 235, 0.10) 0px, transparent 50%)",
            "radial-gradient(circle at 80% 90%, rgba(37, 99, 235, 0.06) 0px, transparent 55%)",
            "linear-gradient(180deg, #000 0%, #000 100%)",
          ].join(","),
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </>
  );
}

export function LandingWordmark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3">
      <span className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
        Global NeoChain Solutions
      </span>
      <img
        src="/logo.png"
        alt=""
        className="h-7 w-7 transition-transform group-hover:scale-105 sm:h-8 sm:w-8"
      />
    </Link>
  );
}

interface NavMenuItem {
  label: string;
  hint: string;
  to: string;
}
interface NavGroup {
  label: string;
  items?: NavMenuItem[];
  to?: string;
}

// Real routes — every entry resolves to a page on this domain. Each
// dropdown item is now its own dedicated page under /services/<slug> or
// /industries/<slug>; "All …" lands on the index that links to all of them.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Services",
    items: [
      { label: "AI & ML models", hint: "Custom-trained, production-ready", to: "/services/ai" },
      { label: "Full-stack engineering", hint: "MERN · Python · Java", to: "/services/fullstack" },
      { label: "Data & analytics", hint: "Pipelines, dashboards, ML", to: "/services/data" },
      { label: "Data science", hint: "Forecasting, segmentation, A/B", to: "/services/data-science" },
      { label: "DevOps & cloud", hint: "CI/CD, infra-as-code", to: "/services/devops" },
      { label: "Product engineering", hint: "0→1 MVPs in 6–10 weeks", to: "/services/products" },
      { label: "All services", hint: "Compare all six capabilities", to: "/services" },
    ],
  },
  {
    label: "Industries",
    items: [
      { label: "Oil & energy", hint: "Predictive maintenance, IoT", to: "/industries/oil" },
      { label: "E-commerce", hint: "Storefronts, payments, CRO", to: "/industries/ecommerce" },
      { label: "Logistics & cold storage", hint: "Fleet, cold-chain, attendance", to: "/industries/logistics" },
      { label: "Construction & contracting", hint: "Project boards, payroll, expenses", to: "/industries/construction" },
      { label: "Fashion & retail", hint: "Per-store chat, merchandising", to: "/industries/fashion" },
      { label: "Hospitality", hint: "Shifts, briefings, seasonal HR", to: "/industries/hospitality" },
      { label: "All industries", hint: "Beverages, fragrance & more", to: "/industries" },
    ],
  },
  { label: "Team", to: "/team" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/#contact" },
];

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="relative z-30 border-b border-white/5 bg-[#000000]/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4 sm:px-8 lg:px-12">
        <LandingWordmark />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_GROUPS.map((g) =>
            g.items ? (
              <NavDropdown key={g.label} group={g} />
            ) : (
              <Link
                key={g.label}
                to={g.to ?? "/"}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {g.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-full border border-white/10 bg-[image:var(--gradient-brand)] px-5 font-semibold text-white shadow-[var(--shadow-cta)] transition-shadow hover:shadow-[var(--glow-purple)]"
          >
            <Link to="/register">Get started</Link>
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-white/5 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#000000]/95 px-6 py-4 lg:hidden">
          <ul className="space-y-1">
            {NAV_GROUPS.map((g) =>
              g.items ? (
                <li key={g.label} className="pt-1">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {g.label}
                  </div>
                  <ul className="space-y-0.5">
                    {g.items.map((it) => (
                      <li key={it.label}>
                        <Link
                          to={it.to}
                          onClick={() => setMobileOpen(false)}
                          className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-white/5"
                        >
                          {it.label}
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                            {it.hint}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={g.label}>
                  <Link
                    to={g.to ?? "/"}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-white/5"
                  >
                    {g.label}
                  </Link>
                </li>
              ),
            )}
            <li className="border-t border-white/5 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-white/5"
              >
                Sign in
              </Link>
            </li>
            <li className="pt-1">
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="block rounded-md border border-white/10 bg-[image:var(--gradient-brand)] px-3 py-2 text-center text-sm font-semibold text-white shadow-[var(--shadow-cta)]"
              >
                Get started
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          open
            ? "bg-white/5 text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {group.label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-[#0c1220] p-2 shadow-2xl shadow-black/50 backdrop-blur-md"
        >
          {group.items?.map((it, i, arr) => {
            // Visually separate the trailing "All …" overview link from the
            // per-topic items above so the dropdown reads as two groups.
            const isAllLink = i === arr.length - 1 && it.label.startsWith("All ");
            return (
              <div key={it.label}>
                {isAllLink && (
                  <div className="my-1 h-px bg-white/10" aria-hidden />
                )}
                <Link
                  role="menuitem"
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="group/menuitem flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{it.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{it.hint}</div>
                  </div>
                  <ChevronDown className="mt-1 h-3 w-3 shrink-0 -rotate-90 text-muted-foreground/50 transition-all group-hover/menuitem:translate-x-0.5 group-hover/menuitem:text-[hsl(258_85%_75%)]" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FooterBar() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#000000]">
      <div className="mx-auto w-full max-w-7xl px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="space-y-4">
            <LandingWordmark />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Global NeoChain Solutions — a software startup building AI, data,
              and full-stack systems for oil & energy, e-commerce, and the
              teams shaping what comes next.
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Block-4, Port View Apartments, G4B, Harinathpuram, Nellore,
              Andhra Pradesh — 524003, India.
            </p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                Email:{" "}
                <a
                  href="mailto:hello@global-neochain.com"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  hello@global-neochain.com
                </a>
              </div>
              <div>
                Phone:{" "}
                <a
                  href="tel:+918000000000"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  +91 80000 00000
                </a>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <FooterCol
              heading="Services"
              links={[
                ["AI & ML", "/services#ai"],
                ["Full-stack", "/services#fullstack"],
                ["Data & analytics", "/services#data"],
                ["DevOps & cloud", "/services#devops"],
              ]}
            />
            <FooterCol
              heading="Industries"
              links={[
                ["Oil & energy", "/industries#oil"],
                ["E-commerce", "/industries#ecommerce"],
                ["All industries", "/industries"],
              ]}
            />
            <FooterCol
              heading="Company"
              links={[
                ["About us", "/about"],
                ["Team", "/team"],
                ["Sign in", "/login"],
                ["Create account", "/register"],
              ]}
            />
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-muted-foreground">
          <span>© 2026 M/S. Global NeoChain Solutions. All rights reserved.</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            v1.0 · ed. 01
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: [string, string][];
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
        {heading}
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link
              to={to}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
        {eyebrow}
      </div>
      <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}
