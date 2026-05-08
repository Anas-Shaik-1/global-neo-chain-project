/**
 * Indian mobile-number helpers.
 *
 * Wire format on the backend: `+91XXXXXXXXXX` (12 chars). Forms in the UI
 * always work with the bare 10-digit subscriber number to keep input
 * straightforward — these helpers translate between the two.
 */

/** Indian mobile = 10 digits starting with 6, 7, 8, or 9. */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Strip a stored E.164 (or country-code-prefixed) Indian phone down to its
 * 10-digit subscriber portion for display in an edit field.
 *
 *   "+919876543210" → "9876543210"
 *   "919876543210"  → "9876543210"
 *   "9876543210"    → "9876543210"
 *   ""              → ""
 *   null/undefined  → ""
 */
export function stripIndianPrefix(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

/** Filter user input down to the 10-digit subscriber number. */
export function sanitizeIndianMobileInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}
