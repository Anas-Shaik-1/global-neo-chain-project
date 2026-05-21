import {
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
import type { Topic } from "../components/ServiceVisual";

export interface Industry {
  id: Topic;
  slug: string;
  navLabel: string;
  navHint: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Sample-work scenarios surfaced on the detail page. */
  scenarios: { title: string; body: string }[];
  bullets: string[];
  /** Service slugs that pair well with this industry. */
  relatedServices: string[];
  /** Optional hero photo — pass-through to ServiceVisual's `image` prop. */
  image?: string;
  Icon: LucideIcon;
  featured?: boolean;
}

export const INDUSTRIES: Industry[] = [
  {
    id: "oil",
    slug: "oil",
    navLabel: "Oil & energy",
    navHint: "Predictive maintenance, IoT",
    eyebrow: "Featured",
    title: "Oil & energy",
    body: "From upstream sensor data to downstream retail, we build the AI, IoT, and operations software that keeps energy assets running. Predictive maintenance, drilling analytics, supply-chain visibility, and field-ops mobile apps for engineers on rigs and refineries.",
    bullets: [
      "Predictive maintenance for rotating equipment",
      "Sensor / SCADA data pipelines into time-series stores",
      "Field-ops apps for engineers on remote sites",
      "HSE & compliance dashboards",
    ],
    scenarios: [
      {
        title: "Predictive maintenance",
        body: "Vibration & temperature signatures from pumps and compressors fed into a model that flags failures 7–10 days early.",
      },
      {
        title: "SCADA → time-series",
        body: "PI-Historian / OPC-UA bridges into Snowflake or InfluxDB so analysts can query historical operations.",
      },
      {
        title: "Field-ops apps",
        body: "Offline-first React Native apps for engineers on rigs — checklists, photo capture, sync when there's signal.",
      },
    ],
    relatedServices: ["ai", "data", "fullstack"],
    image: "https://images.unsplash.com/photo-1611273426858-450e7620a915?w=1280&q=80&auto=format&fit=crop",
    Icon: Flame,
    featured: true,
  },
  {
    id: "ecommerce",
    slug: "ecommerce",
    navLabel: "E-commerce",
    navHint: "Storefronts, payments, CRO",
    eyebrow: "Featured",
    title: "E-commerce",
    body: "Custom storefronts, payment integrations, inventory and order systems, and the AI behind recommendation, search, and fraud detection. Built to handle Black-Friday-grade traffic on day one.",
    bullets: [
      "Headless storefronts (Next.js / Shopify Hydrogen)",
      "Payment gateway integrations & subscription billing",
      "Recommendation, search, and pricing models",
      "Inventory, fulfilment, and returns workflows",
    ],
    scenarios: [
      {
        title: "Headless storefronts",
        body: "Next.js / Hydrogen front-ends backed by Shopify, Commercetools, or a custom Postgres-driven catalog.",
      },
      {
        title: "Recommendation & search",
        body: "Vector search over your catalog plus a re-ranking model trained on your own click & purchase history.",
      },
      {
        title: "Returns & fraud",
        body: "Workflow apps for returns ops, plus models that score risky orders in real time before authorisation.",
      },
    ],
    relatedServices: ["fullstack", "ai", "data"],
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1280&q=80&auto=format&fit=crop",
    Icon: ShoppingCart,
    featured: true,
  },
  {
    id: "logistics",
    slug: "logistics",
    navLabel: "Logistics & cold storage",
    navHint: "Fleet, cold-chain, attendance",
    eyebrow: "Industry",
    title: "Logistics & cold storage",
    body: "Real-time visibility on inbound/outbound shipments, attendance for shift workers across multiple sites, and audit-grade timestamping for cold-chain compliance.",
    bullets: [
      "Fleet & route tracking",
      "Cold-chain temperature audit trails",
      "Multi-site attendance & shift planning",
    ],
    scenarios: [
      {
        title: "Live fleet tracking",
        body: "Driver app + dispatcher dashboard, geofencing, and ETA models that account for traffic and stop history.",
      },
      {
        title: "Cold-chain audit",
        body: "Sensor + RFID timestamps stored immutably so QA teams can prove the chain held end-to-end.",
      },
      {
        title: "Shift planning",
        body: "Multi-site rosters with auto-midnight close and clean handoff for round-the-clock operations.",
      },
    ],
    relatedServices: ["data", "fullstack", "devops"],
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1280&q=80&auto=format&fit=crop",
    Icon: Truck,
  },
  {
    id: "construction",
    slug: "construction",
    navLabel: "Construction & contracting",
    navHint: "Project boards, payroll, expenses",
    eyebrow: "Industry",
    title: "Construction & contracting",
    body: "Project boards for site supervisors, multi-site attendance, expense reimbursement with receipt capture, and payslip PDFs for crews paid by the project.",
    bullets: [
      "Site-level cost & timeline dashboards",
      "Multi-project payroll & expenses",
      "Crew attendance with geo-stamping",
    ],
    scenarios: [
      {
        title: "Site dashboards",
        body: "One screen per project: spend-to-date, schedule slip, open RFIs, and an exception list for the supervisor.",
      },
      {
        title: "Per-project payroll",
        body: "Crews paid by the project rather than the month — payslip PDFs generated and emailed each cycle.",
      },
      {
        title: "Geo-stamped attendance",
        body: "Mobile clock-in with site geofence so payroll reflects who was actually on site, not just who logged in.",
      },
    ],
    relatedServices: ["fullstack", "products"],
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1280&q=80&auto=format&fit=crop",
    Icon: Building2,
  },
  {
    id: "fashion",
    slug: "fashion",
    navLabel: "Fashion & retail",
    navHint: "Per-store chat, merchandising",
    eyebrow: "Industry",
    title: "Fashion & retail",
    body: "Photo-first profiles for in-store staff, group chat per store, attendance with location tagging, and lightweight task boards for collection launches.",
    bullets: [
      "Per-store group chat & briefings",
      "Visual merchandising checklists",
      "Collection-launch task boards",
    ],
    scenarios: [
      {
        title: "Per-store chat",
        body: "Each store gets its own group; HQ broadcasts go out as pinned briefings, no more WhatsApp sprawl.",
      },
      {
        title: "VM checklists",
        body: "Photo-driven merchandising checks — staff submit images, regional managers review with a single tap.",
      },
      {
        title: "Collection launches",
        body: "Task boards per launch with copy, photo briefs, and store-level rollout status visible to HQ.",
      },
    ],
    relatedServices: ["fullstack", "products"],
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1280&q=80&auto=format&fit=crop",
    Icon: Sparkles,
  },
  {
    id: "hospitality",
    slug: "hospitality",
    navLabel: "Hospitality",
    navHint: "Shifts, briefings, seasonal HR",
    eyebrow: "Industry",
    title: "Hospitality",
    body: "Shift-based attendance with auto-midnight close, group calls for daily briefings across properties, and HR-approved onboarding for seasonal hires.",
    bullets: [
      "Shift attendance & auto-midnight close",
      "Daily group call briefings",
      "Seasonal HR onboarding pipeline",
    ],
    scenarios: [
      {
        title: "Shift attendance",
        body: "Auto-midnight close handles late check-outs without breaking the daily roll-up.",
      },
      {
        title: "Daily briefings",
        body: "Group calls between properties for occupancy, VIP arrivals, and incidents — recorded for night staff.",
      },
      {
        title: "Seasonal HR",
        body: "Self-registration with HR/Admin two-stage approval so seasonal hires onboard in hours, not days.",
      },
    ],
    relatedServices: ["fullstack", "products"],
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1280&q=80&auto=format&fit=crop",
    Icon: Hotel,
  },
  {
    id: "beverages",
    slug: "beverages",
    navLabel: "Beverages & FMCG",
    navHint: "Field sales, expenses, route ops",
    eyebrow: "Industry",
    title: "Beverages & FMCG",
    body: "Field-sales attendance, expense submissions with receipt photos, and a shared task board between back-office and on-route teams.",
    bullets: [
      "Field-sales attendance",
      "Receipt-photo expense flow",
      "On-route + back-office task board",
    ],
    scenarios: [
      {
        title: "Field-sales attendance",
        body: "Geo-stamped clock-in at the outlet so HQ can see route adherence in near-real-time.",
      },
      {
        title: "Photo-receipt expenses",
        body: "Submit a photo, OCR extracts the line items, finance approves without paperwork.",
      },
      {
        title: "Shared task board",
        body: "On-route reps and back-office ops share a single board so promo rollouts don't fall through the cracks.",
      },
    ],
    relatedServices: ["fullstack", "products"],
    image: "https://images.unsplash.com/photo-1546173159-315724a31696?w=1280&q=80&auto=format&fit=crop",
    Icon: GlassWater,
  },
  {
    id: "fragrance",
    slug: "fragrance",
    navLabel: "Fragrance & beauty",
    navHint: "Brand profiles, mobile workspace",
    eyebrow: "Industry",
    title: "Fragrance & beauty",
    body: "Brand-safe profile photos, quick onboarding for retail staff, and a chat-first workspace that runs comfortably on phones.",
    bullets: [
      "Brand-safe staff profiles",
      "Mobile-first chat workspace",
      "Quick retail onboarding",
    ],
    scenarios: [
      {
        title: "Brand-safe profiles",
        body: "Photo guidelines enforced at upload — every team member's profile passes brand QA without HR intervention.",
      },
      {
        title: "Mobile-first chat",
        body: "Designed phone-first — counter staff use it like a messenger, not a heavy enterprise app.",
      },
      {
        title: "Retail onboarding",
        body: "New hires register, HR approves, manager assigns a store — done in an afternoon.",
      },
    ],
    relatedServices: ["products", "fullstack"],
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=1280&q=80&auto=format&fit=crop",
    Icon: Droplets,
  },
  {
    id: "asset-ops",
    slug: "asset-ops",
    navLabel: "Asset operations & B2B",
    navHint: "Bug tracker, ops kanban, audit",
    eyebrow: "Industry",
    title: "Asset operations & B2B",
    body: "Bug tracker for internal tools, kanban for ops sprints, and audit-ready logs across attendance, payroll, and approvals.",
    bullets: [
      "Internal-tools bug tracker",
      "Ops sprint kanban",
      "Audit-ready approval logs",
    ],
    scenarios: [
      {
        title: "Internal bug tracker",
        body: "Tickets per internal tool with severity routing, escalation, and a public-internal status page.",
      },
      {
        title: "Ops kanban",
        body: "Two-week sprint cadence for ops teams with the same kanban affordances engineering uses.",
      },
      {
        title: "Audit logs",
        body: "Immutable approval logs across attendance edits, payroll, and expense flows — clean export for auditors.",
      },
    ],
    relatedServices: ["products", "data"],
    image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1280&q=80&auto=format&fit=crop",
    Icon: Boxes,
  },
];

export function getIndustryBySlug(slug: string | undefined): Industry | undefined {
  if (!slug) return undefined;
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function getRelatedIndustries(slug: string, limit = 3): Industry[] {
  return INDUSTRIES.filter((i) => i.slug !== slug).slice(0, limit);
}
