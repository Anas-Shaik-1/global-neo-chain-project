import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Cloud,
  Code2,
  Database,
  GitBranch,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell, SectionHeading } from "../components/MarketingChrome";
import { ServiceVisual, type Topic } from "../components/ServiceVisual";

interface ServiceGroup {
  id: Topic;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  Icon: LucideIcon;
  tone: string;
  /** Optional override — drop a real photo at /public/services/<id>.jpg. */
  image?: string;
}

const SERVICES: ServiceGroup[] = [
  {
    id: "ai",
    eyebrow: "01 — AI & ML",
    title: "Custom AI models, trained on your data.",
    body: "From a first-pass classifier to a domain-tuned LLM that ships behind your product, we build the model, the data pipeline that feeds it, and the eval harness that proves it works.",
    bullets: [
      "Predictive maintenance, demand forecasting, fraud detection",
      "Fine-tuned LLMs for internal copilots & document Q&A",
      "Retrieval-augmented generation (RAG) on private corpora",
      "MLOps: training, evaluation, drift monitoring",
    ],
    Icon: Bot,
    tone: "from-violet-500/20 to-fuchsia-500/0",
  },
  {
    id: "fullstack",
    eyebrow: "02 — Full-stack engineering",
    title: "Apps that ship — MERN, Python, Java.",
    body: "Production web and mobile apps end-to-end. We pick the stack that fits your team and constraints, then build it like we'll be the ones supporting it on call (because we usually are).",
    bullets: [
      "MERN: React / Next.js, Node, MongoDB, Express",
      "Python full-stack: FastAPI, Django, Postgres, Celery",
      "Java full-stack: Spring Boot, JPA, Postgres / Oracle",
      "Mobile: React Native, native Android / iOS",
    ],
    Icon: Code2,
    tone: "from-cyan-500/20 to-sky-500/0",
  },
  {
    id: "data",
    eyebrow: "03 — Data & analytics",
    title: "Pipelines that move clean data on time.",
    body: "Whether you need a single dashboard or a warehouse-grade analytics platform, we ingest from your sources, model the data, and put numbers in front of decision-makers.",
    bullets: [
      "ETL / ELT pipelines (Airflow, dbt, Spark)",
      "Warehouses: Snowflake, BigQuery, Redshift, Postgres",
      "Embedded dashboards: Metabase, Superset, Looker",
      "Self-serve analytics for ops, finance, and product",
    ],
    Icon: BarChart3,
    tone: "from-emerald-500/20 to-teal-500/0",
  },
  {
    id: "datascience",
    eyebrow: "04 — Data science",
    title: "Statistical insight that drives business calls.",
    body: "Bayesian A/B tests, churn modelling, customer segmentation, time-series forecasting — work that turns business questions into defensible numbers.",
    bullets: [
      "Customer segmentation & cohort analysis",
      "Forecasting: revenue, demand, capacity",
      "Causal inference & uplift modelling",
      "Notebooks → production: model registry + serving",
    ],
    Icon: Database,
    tone: "from-amber-500/20 to-orange-500/0",
  },
  {
    id: "devops",
    eyebrow: "05 — DevOps & cloud",
    title: "Infrastructure that doesn't wake your team up.",
    body: "CI/CD pipelines, container orchestration, infra-as-code, observability — the boring stuff that decides whether your team ships every week or fights fires.",
    bullets: [
      "Kubernetes, Docker, Helm",
      "Terraform / Pulumi infra-as-code",
      "GitHub Actions / GitLab CI / ArgoCD",
      "AWS, GCP, Azure — multi-cloud where it makes sense",
    ],
    Icon: Cloud,
    tone: "from-blue-500/20 to-indigo-500/0",
  },
  {
    id: "products",
    eyebrow: "06 — Product engineering",
    title: "From idea to first paying customer.",
    body: "We've built and shipped our own EMS workspace — same playbook for yours. Discovery, design, build, deploy, hand-off documented in working code.",
    bullets: [
      "0→1 MVPs with a 6–10 week ship cadence",
      "Design systems, component libraries",
      "Product analytics & experimentation tooling",
      "Hand-off with full source, infra, and runbooks",
    ],
    Icon: Layers,
    tone: "from-rose-500/20 to-pink-500/0",
  },
];

function ServiceCard({ s }: { s: ServiceGroup }) {
  const { Icon } = s;
  return (
    <article
      id={s.id}
      className="group relative scroll-mt-24 overflow-hidden rounded-3xl border border-white/10 bg-[#1a1338]/60 p-5 transition-colors hover:border-white/20 sm:p-6"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br ${s.tone} blur-2xl`}
      />
      <ServiceVisual topic={s.id} image={s.image} alt={s.title} />
      <div className="relative px-2 pt-6 sm:px-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#0d0820]">
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
      </div>
    </article>
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
                <span className="bg-gradient-to-r from-[hsl(258_90%_75%)] to-[hsl(270_75%_60%)] bg-clip-text text-transparent">
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

        <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(258_75%_60%/0.18)] via-[hsl(258_50%_25%/0.2)] to-[#0d0820] p-10 text-center sm:p-14">
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
              <Link to="/industries">Industries we serve</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
