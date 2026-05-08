/**
 * Pick the best avatar URL for a given UI size. The Cloudinary variants are
 * pre-sized at 64 / 128 / 512 with a face-aware crop; local-storage users
 * have a single URL, returned for every size. Caller passes the largest
 * the surface needs and we round up to the next available bucket.
 */

export type AvatarSize = "small" | "medium" | "large";

interface AvatarSource {
  avatarUrl?: string | null;
  avatarVariants?: {
    small: string | null;
    medium: string | null;
    large: string | null;
  } | null;
}

export function avatarFor(
  source: AvatarSource | null | undefined,
  size: AvatarSize = "medium",
): string | null {
  if (!source) return null;
  const v = source.avatarVariants;
  if (v) {
    const ordered =
      size === "small"
        ? [v.small, v.medium, v.large]
        : size === "medium"
          ? [v.medium, v.large, v.small]
          : [v.large, v.medium, v.small];
    for (const u of ordered) if (u) return u;
  }
  return source.avatarUrl ?? null;
}
