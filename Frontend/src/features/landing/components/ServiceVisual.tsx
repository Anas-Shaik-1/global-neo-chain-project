import { useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  Cloud,
  Code2,
  Database,
  Droplets,
  Flame,
  GlassWater,
  Hotel,
  Layers,
  ShoppingCart,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * Stylised visual for a service or industry card. Renders a real `<img>`
 * when `image` is provided (drop a JPG/PNG at /public/services/<slug>.jpg
 * or /public/industries/<slug>.jpg), and otherwise composes a SVG-and-icon
 * placeholder so every card ships with something visual today.
 *
 * Design choices:
 *   - Wide-aspect (16:10) so cards feel editorial.
 *   - Gradient backdrop tinted to the topic.
 *   - Big topic icon at low opacity, plus abstract decorative shapes that
 *     hint at the work without claiming to be a screenshot.
 */
export type Topic =
  // Services
  | "ai"
  | "fullstack"
  | "data"
  | "datascience"
  | "devops"
  | "products"
  // Industries
  | "oil"
  | "ecommerce"
  | "logistics"
  | "construction"
  | "fashion"
  | "hospitality"
  | "beverages"
  | "fragrance"
  | "asset-ops";

interface TopicMeta {
  Icon: LucideIcon;
  /** From-color hue / saturation / lightness for the gradient. */
  fromHsl: string;
  toHsl: string;
  /** A second, smaller decorative accent icon for visual variety. */
  AccentIcon?: LucideIcon;
}

const TOPICS: Record<Topic, TopicMeta> = {
  ai: { Icon: Bot, fromHsl: "265 80% 55%", toHsl: "300 75% 50%", AccentIcon: Sparkles },
  fullstack: { Icon: Code2, fromHsl: "200 85% 50%", toHsl: "220 80% 45%" },
  data: { Icon: BarChart3, fromHsl: "160 70% 45%", toHsl: "180 70% 40%" },
  datascience: { Icon: Database, fromHsl: "30 85% 55%", toHsl: "20 80% 50%" },
  devops: { Icon: Cloud, fromHsl: "215 80% 55%", toHsl: "250 75% 55%" },
  products: { Icon: Layers, fromHsl: "340 75% 55%", toHsl: "320 70% 50%" },

  oil: { Icon: Flame, fromHsl: "20 90% 55%", toHsl: "0 80% 50%" },
  ecommerce: { Icon: ShoppingCart, fromHsl: "280 75% 55%", toHsl: "260 75% 50%" },
  logistics: { Icon: Truck, fromHsl: "200 70% 50%", toHsl: "180 70% 45%" },
  construction: { Icon: Building2, fromHsl: "40 80% 55%", toHsl: "30 75% 50%" },
  fashion: { Icon: Sparkles, fromHsl: "330 80% 60%", toHsl: "310 75% 55%" },
  hospitality: { Icon: Hotel, fromHsl: "250 70% 55%", toHsl: "270 70% 50%" },
  beverages: { Icon: GlassWater, fromHsl: "150 70% 45%", toHsl: "170 70% 40%" },
  fragrance: { Icon: Droplets, fromHsl: "310 75% 60%", toHsl: "290 70% 55%" },
  "asset-ops": { Icon: Layers, fromHsl: "210 60% 45%", toHsl: "230 60% 40%" },
};

interface Props {
  topic: Topic;
  /** Optional path under /public, e.g. "/services/ai.jpg". */
  image?: string;
  /** Alt text for the real-image branch. */
  alt?: string;
  /** Tailwind aspect class. Defaults to 16:10 (`aspect-[16/10]`). */
  aspect?: string;
  className?: string;
}

export function ServiceVisual({
  topic,
  image,
  alt,
  aspect = "aspect-[16/10]",
  className = "",
}: Props) {
  const meta = TOPICS[topic];
  const baseCls = `relative overflow-hidden rounded-2xl ${aspect} ${className}`;

  // If the real image fails to load (broken URL, network blocked, etc.),
  // fall through to the gradient + icon placeholder branch below so a card
  // never renders with a busted-image icon. Tracks the error state per
  // mounted instance.
  const [imageFailed, setImageFailed] = useState(false);

  if (image && !imageFailed) {
    return (
      <div className={baseCls}>
        <img
          src={image}
          alt={alt ?? topic}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#000000]/70 via-[#000000]/20 to-transparent"
        />
      </div>
    );
  }

  const { Icon, fromHsl, toHsl, AccentIcon } = meta;
  const gradient = `linear-gradient(135deg, hsl(${fromHsl}) 0%, hsl(${toHsl}) 100%)`;

  return (
    <div
      aria-hidden
      className={`${baseCls} ring-1 ring-white/10`}
      style={{ backgroundImage: gradient }}
    >
      {/* Soft radial highlight */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.25) 0%, transparent 45%)",
        }}
      />
      {/* Decorative grid overlay so the surface doesn't read flat */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 320 200"
      >
        <defs>
          <pattern id={`grid-${topic}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="320" height="200" fill={`url(#grid-${topic})`} />
      </svg>
      {/* Floating shapes — abstract hint of "the work" */}
      <div className="absolute -bottom-8 -right-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -top-10 -left-6 h-24 w-24 rounded-full bg-black/30 blur-xl" />

      {/* Topic icon at large size */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="h-20 w-20 text-white/85 drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24" />
      </div>

      {/* Optional accent icon top-right */}
      {AccentIcon && (
        <AccentIcon className="absolute right-3 top-3 h-4 w-4 text-white/70" />
      )}
    </div>
  );
}
