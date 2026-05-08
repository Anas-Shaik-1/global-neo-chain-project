// Exchange rates for MVP — real production would fetch from an API daily.
// Rates as of ~2026-04 — adjust if needed.
export const INR_RATES: Record<string, number> = {
  INR: 1,
  USD: 83,
};

/**
 * Returns the INR conversion rate for `currency` at `atDate` (defaults to now).
 *
 * STUB: this currently returns the hard-coded rate from `INR_RATES` regardless
 * of `atDate`. Production must wire this to a real FX provider (e.g. ECB,
 * OpenExchangeRates) that can return a historical rate for `atDate`. The
 * `atDate` parameter is accepted now so callers can already snapshot rates
 * at write time — once the real provider lands, we won't need to change
 * call sites.
 *
 * Unknown currencies fall back to 1 (same as `toInrCents`) so callers that
 * snapshot the rate get a predictable, bounded number rather than NaN.
 */
export function getInrRateAt(
  currency: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  atDate?: Date,
): number {
  return INR_RATES[currency.toUpperCase()] ?? 1;
}

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
