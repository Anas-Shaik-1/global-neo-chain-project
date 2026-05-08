/**
 * Indian-mobile phone helpers shared by registration + employee-update paths.
 *
 * Wire/storage format: `+91XXXXXXXXXX` (E.164). The Zod layer at the API
 * boundary validates the bare 10-digit subscriber number; the service layer
 * uses {@link toIndianE164} to attach the country code before persisting.
 */

/** Indian mobile = exactly 10 digits, leading 6/7/8/9. */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Convert a 10-digit Indian subscriber number to its `+91`-prefixed E.164 form.
 *
 * Idempotent: input that's already `+91XXXXXXXXXX` (or `91XXXXXXXXXX`) round-trips
 * unchanged. Returns `undefined` for empty input so callers can use
 * `phone: toIndianE164(input.phone)` and have a missing phone stay missing.
 *
 * Throws if the input doesn't normalize to a valid 10-digit subscriber — the
 * Zod schemas at the API boundary should already have caught that, so this
 * is a defence-in-depth check rather than a primary validator.
 */
export function toIndianE164(input: string | null | undefined): string | undefined {
  if (input == null) return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  const digits = trimmed.replace(/\D/g, "");
  const last10 = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!INDIAN_MOBILE_REGEX.test(last10)) {
    throw new Error(`Invalid Indian mobile number: ${input}`);
  }
  return `+91${last10}`;
}
