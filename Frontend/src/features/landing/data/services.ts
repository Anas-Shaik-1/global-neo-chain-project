import {
  BarChart3,
  Bot,
  Cloud,
  Code2,
  Database,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { Topic } from "../components/ServiceVisual";

export interface ServiceGroup {
  id: Topic;
  /** Short slug used in routes — same as `id` for services. */
  slug: string;
  eyebrow: string;
  /** Short label used in navbar / breadcrumbs. */
  navLabel: string;
  /** Tagline rendered under nav-dropdown items. */
  navHint: string;
  title: string;
  body: string;
  bullets: string[];
  /** Stack pills for the detail page. */
  stack: string[];
  /** "How we work" three-step rhythm — overrides the default if set. */
  process?: { step: string; title: string; body: string }[];
  Icon: LucideIcon;
  tone: string;
  /** Optional override — drop a real photo at /public/services/<id>.jpg. */
  image?: string;
}

const DEFAULT_PROCESS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Discovery",
    body: "Two-week paid discovery: stakeholder interviews, data review, and a written scope you can act on.",
  },
  {
    step: "02",
    title: "Build",
    body: "Senior team works in 2-week sprints. Demos every Friday, code on your GitHub, infra in your accounts.",
  },
  {
    step: "03",
    title: "Hand-off",
    body: "Working code, runbooks, and a 30-day support window so your team owns the system from day one.",
  },
];

export const SERVICES: ServiceGroup[] = [
  {
    id: "ai",
    slug: "ai",
    navLabel: "AI & ML models",
    navHint: "Custom-trained, production-ready",
    eyebrow: "01 — AI & ML",
    title: "Custom AI models, trained on your data.",
    body: "From a first-pass classifier to a domain-tuned LLM that ships behind your product, we build the model, the data pipeline that feeds it, and the eval harness that proves it works.",
    bullets: [
      "Predictive maintenance, demand forecasting, fraud detection",
      "Fine-tuned LLMs for internal copilots & document Q&A",
      "Retrieval-augmented generation (RAG) on private corpora",
      "MLOps: training, evaluation, drift monitoring",
    ],
    stack: [
      "PyTorch",
      "Hugging Face",
      "LangChain",
      "OpenAI / Anthropic / Bedrock",
      "MLflow",
      "Weaviate / Pinecone",
      "Vertex AI",
      "SageMaker",
    ],
    process: [
      {
        step: "01",
        title: "Data audit",
        body: "We start with the data — what you have, what's labelled, and the gap to a defensible model.",
      },
      {
        step: "02",
        title: "Iterate to baseline",
        body: "Ship a working baseline in week 4. Eval harness from day one so improvements are measurable.",
      },
      {
        step: "03",
        title: "Productionise",
        body: "Serving infra, drift monitors, retraining pipeline. Hand off the model and the system around it.",
      },
    ],
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1280&q=80&auto=format&fit=crop",
    Icon: Bot,
    tone: "from-violet-500/20 to-fuchsia-500/0",
  },
  {
    id: "fullstack",
    slug: "fullstack",
    navLabel: "Full-stack engineering",
    navHint: "MERN · Python · Java",
    eyebrow: "02 — Full-stack engineering",
    title: "Apps that ship — MERN, Python, Java.",
    body: "Production web and mobile apps end-to-end. We pick the stack that fits your team and constraints, then build it like we'll be the ones supporting it on call (because we usually are).",
    bullets: [
      "MERN: React / Next.js, Node, MongoDB, Express",
      "Python full-stack: FastAPI, Django, Postgres, Celery",
      "Java full-stack: Spring Boot, JPA, Postgres / Oracle",
      "Mobile: React Native, native Android / iOS",
    ],
    stack: [
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "FastAPI",
      "Django",
      "Spring Boot",
      "Postgres",
      "MongoDB",
      "Redis",
      "React Native",
    ],
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1280&q=80&auto=format&fit=crop",
    Icon: Code2,
    tone: "from-cyan-500/20 to-sky-500/0",
  },
  {
    id: "data",
    slug: "data",
    navLabel: "Data & analytics",
    navHint: "Pipelines, dashboards, ML",
    eyebrow: "03 — Data & analytics",
    title: "Pipelines that move clean data on time.",
    body: "Whether you need a single dashboard or a warehouse-grade analytics platform, we ingest from your sources, model the data, and put numbers in front of decision-makers.",
    bullets: [
      "ETL / ELT pipelines (Airflow, dbt, Spark)",
      "Warehouses: Snowflake, BigQuery, Redshift, Postgres",
      "Embedded dashboards: Metabase, Superset, Looker",
      "Self-serve analytics for ops, finance, and product",
    ],
    stack: [
      "Airflow",
      "dbt",
      "Spark",
      "Kafka",
      "Snowflake",
      "BigQuery",
      "Redshift",
      "Metabase",
      "Superset",
      "Looker",
      "Fivetran",
    ],
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1280&q=80&auto=format&fit=crop",
    Icon: BarChart3,
    tone: "from-emerald-500/20 to-teal-500/0",
  },
  {
    id: "datascience",
    slug: "data-science",
    navLabel: "Data science",
    navHint: "Forecasting, segmentation, A/B",
    eyebrow: "04 — Data science",
    title: "Statistical insight that drives business calls.",
    body: "Bayesian A/B tests, churn modelling, customer segmentation, time-series forecasting — work that turns business questions into defensible numbers.",
    bullets: [
      "Customer segmentation & cohort analysis",
      "Forecasting: revenue, demand, capacity",
      "Causal inference & uplift modelling",
      "Notebooks → production: model registry + serving",
    ],
    stack: [
      "Python",
      "R",
      "scikit-learn",
      "statsmodels",
      "PyMC",
      "Prophet",
      "MLflow",
      "Jupyter",
      "Pandas",
    ],
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1280&q=80&auto=format&fit=crop",
    Icon: Database,
    tone: "from-amber-500/20 to-orange-500/0",
  },
  {
    id: "devops",
    slug: "devops",
    navLabel: "DevOps & cloud",
    navHint: "CI/CD, infra-as-code",
    eyebrow: "05 — DevOps & cloud",
    title: "Infrastructure that doesn't wake your team up.",
    body: "CI/CD pipelines, container orchestration, infra-as-code, observability — the boring stuff that decides whether your team ships every week or fights fires.",
    bullets: [
      "Kubernetes, Docker, Helm",
      "Terraform / Pulumi infra-as-code",
      "GitHub Actions / GitLab CI / ArgoCD",
      "AWS, GCP, Azure — multi-cloud where it makes sense",
    ],
    stack: [
      "Kubernetes",
      "Docker",
      "Helm",
      "Terraform",
      "Pulumi",
      "GitHub Actions",
      "ArgoCD",
      "AWS",
      "GCP",
      "Azure",
      "Datadog",
      "Grafana",
    ],
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1280&q=80&auto=format&fit=crop",
    Icon: Cloud,
    tone: "from-blue-500/20 to-indigo-500/0",
  },
  {
    id: "products",
    slug: "products",
    navLabel: "Product engineering",
    navHint: "0→1 MVPs in 6–10 weeks",
    eyebrow: "06 — Product engineering",
    title: "From idea to first paying customer.",
    body: "We've built and shipped our own EMS workspace — same playbook for yours. Discovery, design, build, deploy, hand-off documented in working code.",
    bullets: [
      "0→1 MVPs with a 6–10 week ship cadence",
      "Design systems, component libraries",
      "Product analytics & experimentation tooling",
      "Hand-off with full source, infra, and runbooks",
    ],
    stack: [
      "TypeScript",
      "React",
      "Next.js",
      "Tailwind",
      "shadcn/ui",
      "Postgres",
      "Stripe",
      "Mixpanel",
      "PostHog",
    ],
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1280&q=80&auto=format&fit=crop",
    Icon: Layers,
    tone: "from-rose-500/20 to-pink-500/0",
  },
];

export function getServiceBySlug(slug: string | undefined): ServiceGroup | undefined {
  if (!slug) return undefined;
  return SERVICES.find((s) => s.slug === slug);
}

export function getRelatedServices(slug: string, limit = 3): ServiceGroup[] {
  return SERVICES.filter((s) => s.slug !== slug).slice(0, limit);
}

export const SERVICE_PROCESS_DEFAULT = DEFAULT_PROCESS;
