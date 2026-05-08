import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell, SectionHeading } from "../components/MarketingChrome";
import { TeamAvatar } from "../components/TeamAvatar";
import {
  ASSOCIATES,
  ENGINEERS,
  LEADERSHIP,
  type TeamMember,
} from "../data/team";

function MemberCard({ m }: { m: TeamMember }) {
  return (
    <div className="group flex flex-col items-center text-center">
      <TeamAvatar member={m} />
      <div className="mt-4 font-display text-base font-bold tracking-tight text-foreground">
        {m.name}
      </div>
      <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{m.role}</div>
    </div>
  );
}

function TeamRow({
  title,
  eyebrow,
  members,
}: {
  title: string;
  eyebrow: string;
  members: TeamMember[];
}) {
  return (
    <section className="mt-16 first:mt-0">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(258_85%_75%)]">
            {eyebrow}
          </div>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h3>
        </div>
        <div className="hidden font-mono text-xs text-muted-foreground sm:block">
          {members.length} {members.length === 1 ? "person" : "people"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
        {members.map((m) => (
          <MemberCard key={m.name} m={m} />
        ))}
      </div>
    </section>
  );
}

export function TeamPage() {
  useEffect(() => {
    document.title = "Team · Global NeoChain Solutions";
  }, []);

  const total = LEADERSHIP.length + ENGINEERS.length + ASSOCIATES.length;

  return (
    <MarketingShell>
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-10 pt-16 sm:px-8 sm:pt-24 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading
            eyebrow="The team"
            title={
              <>
                Meet the people who{" "}
                <span className="bg-gradient-to-r from-[hsl(258_90%_75%)] to-[hsl(270_75%_60%)] bg-clip-text text-transparent">
                  ship the work.
                </span>
              </>
            }
            subtitle={`A ${total}-person engineering team building AI, full-stack, data, and DevOps systems for clients in oil & energy, e-commerce, and beyond.`}
          />
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8 lg:px-12">
        <TeamRow eyebrow="Leadership" title="Steering the ship." members={LEADERSHIP} />
        <TeamRow eyebrow="Engineering" title="Building the product." members={ENGINEERS} />
        <TeamRow eyebrow="Associates" title="Carrying the bench." members={ASSOCIATES} />

        <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.18)] via-[hsl(258_50%_25%/0.2)] to-[#0d0820] p-10 text-center sm:p-14">
          <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Want to join us?
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            We're always hiring engineers who care about what they build. Send
            your CV and we'll get back within a few days.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[hsl(258_75%_60%)] px-7 font-semibold text-white shadow-[0_12px_30px_-10px_hsl(258_75%_60%/0.6)] hover:bg-[hsl(258_75%_55%)]"
            >
              <a href="mailto:careers@global-neochain.com">
                Email careers@global-neochain.com
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-white/15 bg-white/[0.02] px-6 text-foreground hover:bg-white/5"
            >
              <Link to="/about">About us</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
