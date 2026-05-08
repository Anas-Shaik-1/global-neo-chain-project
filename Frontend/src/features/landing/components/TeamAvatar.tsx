import { useState } from "react";
import {
  type TeamMember,
  defaultPhotoFor,
  gradientFor,
  initialsOf,
} from "../data/team";

/**
 * Renders a team member's avatar.
 *
 * Resolution order:
 *   1. `member.photo` if explicitly set on the data row.
 *   2. Otherwise the conventional `/team/<slug>.jpg` file.
 *   3. If that 404s, fall back to a deterministic gradient + initials disc.
 *
 * The fallback runs at the component level (onError → state flip) so missing
 * photos never render a broken-image icon. Drop a JPG into
 * `Frontend/public/team/` named after the member's slug (e.g.
 * `ruhina-begum-shaik.jpg`) and it appears on next reload — no code change.
 */
export function TeamAvatar({
  member,
  size = "md",
}: {
  member: TeamMember;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm"
      ? "h-14 w-14 text-sm sm:h-16 sm:w-16"
      : size === "lg"
        ? "h-28 w-28 text-2xl sm:h-32 sm:w-32 sm:text-3xl"
        : "h-24 w-24 text-xl sm:h-28 sm:w-28 sm:text-2xl";

  const src = member.photo ?? defaultPhotoFor(member.name);
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={src}
        alt={member.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${dims} rounded-full object-cover ring-2 ring-white/10 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:ring-[hsl(258_85%_75%/0.7)]`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`relative ${dims} rounded-full ring-2 ring-white/10 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:ring-[hsl(258_85%_75%/0.7)]`}
      style={{ backgroundImage: gradientFor(member.name) }}
    >
      <span className="absolute inset-0 grid place-items-center font-display font-bold text-white">
        {initialsOf(member.name)}
      </span>
    </div>
  );
}
