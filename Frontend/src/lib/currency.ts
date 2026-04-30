/**
 * Format paise (smallest INR unit, e.g. 207500 → ₹2,075) as a localized rupee
 * string with Indian thousands grouping. Mirrors `formatInr` on the backend
 * but drops the fractional digits to keep dashboard numbers readable.
 */
export function formatInrCents(cents: number): string {
  const rupees = cents / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Compact Hh Mm formatter — drops zero components so "120" is "2h" rather
 * than "2h 0m". Used by the working-hours chart.
 */
export function formatHoursMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
