import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Mic, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell, SectionHeading } from "../components/MarketingChrome";

export function AboutPage() {
  useEffect(() => {
    document.title = "About · Global NeoChain Solutions";
  }, []);

  return (
    <MarketingShell>
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-12 pt-16 sm:px-8 sm:pt-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="About us"
            title={
              <>
                A startup building software for{" "}
                <span className="bg-gradient-to-r from-[hsl(258_90%_75%)] to-[hsl(270_75%_60%)] bg-clip-text text-transparent">
                  what comes next.
                </span>
              </>
            }
            subtitle="Global NeoChain Solutions is a small, senior engineering team based in Nellore, India. We build AI, full-stack, data, and DevOps systems for clients in oil & energy, e-commerce, and beyond — and ship our own products on the side."
          />
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-16 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-3">
          <ValueCard
            Icon={Sparkles}
            title="Senior-first engineering"
            body="Every project is staffed by a small senior team. The people writing the code are the ones you talk to — no offshore handoffs, no junior-only squads."
          />
          <ValueCard
            Icon={Compass}
            title="Outcome over output"
            body="We measure success by what shipped and what it changed for your business — not by hours billed or screens delivered."
          />
          <ValueCard
            Icon={Shield}
            title="Production-grade by default"
            body="Auth, audit logs, observability, CI/CD. We don't ship demos — we ship systems that survive Monday morning."
          />
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-16 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#1a1338]/60 p-10 sm:p-14">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(258_85%_75%)]">
                The story
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Founded by engineers, run by engineers.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                We started Global NeoChain Solutions because the consultancies
                we'd worked with sold deliverables, not outcomes — slide
                decks instead of running code, junior teams instead of
                senior owners.
              </p>
              <p>
                Our pitch is simple: a small senior team, working in a code
                base they own end-to-end, on a product the people in the room
                personally care about. The result is software that ships
                faster and survives longer.
              </p>
              <p>
                Today we run engagements across oil & energy and e-commerce
                while also shipping our own products — like the workspace
                you're reading about on this site, in production with{" "}
                <Link
                  to="/team"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  the team
                </Link>{" "}
                that built it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-3">
          <Stat label="Engineering team" value="23+" />
          <Stat label="Industries shipped" value="9" />
          <Stat label="Time zones" value="3" />
        </div>

        <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.18)] via-[hsl(258_50%_25%/0.2)] to-[#0d0820] p-10 text-center sm:p-14">
          <Mic className="mx-auto h-7 w-7 text-[hsl(258_85%_75%)]" />
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Want to work with us?
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            We take a small number of new engagements each quarter so the
            senior team can stay deep on each project. The earlier we talk,
            the better.
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
              <Link to="/team">Meet the team</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function ValueCard({
  Icon,
  title,
  body,
}: {
  Icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#1a1338]/60 p-7 transition-colors hover:border-white/20">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(258_75%_60%/0.15)] text-[hsl(258_85%_75%)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-5 font-display text-lg font-bold tracking-tight">
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#1a1338]/60 p-8 text-center sm:p-10">
      <div className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {value}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
