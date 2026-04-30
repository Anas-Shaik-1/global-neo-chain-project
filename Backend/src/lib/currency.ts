// Exchange rates for MVP — real production would fetch from an API daily.
// Rates as of ~2026-04 — adjust if needed.
export const INR_RATES: Record<string, number> = {
  INR: 1,
  USD: 83,
};

/**
 * Convert an amount in the smallest currency unit of `currency` (cents/paise)
 * into INR paise. Unknown currencies fall back to a 1:1 rate so a missing
 * lookup never throws — surfaces a wrong-but-bounded number rather than a 500.
 */
export function toInrCents(amount: number, currency: string): number {
  const rate = INR_RATES[currency.toUpperCase()] ?? 1;
  return Math.round(amount * rate);
}

/**
 * Format paise (smallest INR unit) as a localized rupee string, e.g.
 * `₹2,07,500.00` — using Indian thousands grouping.
 */
export function formatInr(cents: number): string {
  const rupees = cents / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatCurrency(cents: number, currency: string): string {
  const rupees = cents / 100;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(rupees);
}
