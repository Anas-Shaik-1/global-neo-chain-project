import { z } from "zod";
import { BREAKDOWN_KINDS } from "./api/hooks";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM (e.g. 2026-04)");

export const currencySchema = z
  .string()
  .length(3, "3-letter currency code")
  .regex(/^[A-Z]{3}$/, "ISO 4217 (uppercase)");

/**
 * Rupee → paise transformer. The form lets users type a natural ₹ amount
 * (e.g. "50000" or "50000.50"); we coerce that to integer paise on the way
 * to the API. Two decimals are honoured; anything beyond is rounded to the
 * nearest paisa via Math.round.
 */
const rupeeAmount = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const raw = typeof v === "number" ? String(v) : v.trim();
    if (raw === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount is required",
      });
      return z.NEVER;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use rupees, up to two decimals (e.g. 50000 or 50000.75)",
      });
      return z.NEVER;
    }
    const rupees = Number(raw);
    if (!Number.isFinite(rupees) || rupees < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be zero or greater",
      });
      return z.NEVER;
    }
    return Math.round(rupees * 100);
  });

export const breakdownItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(60, "Label must be 60 characters or fewer"),
  amount: rupeeAmount,
  kind: z.enum(BREAKDOWN_KINDS),
});
export type BreakdownItemValues = z.infer<typeof breakdownItemSchema>;

export const GeneratePayslipSchema = z.object({
  userId: z
    .string()
    .min(1, "Please choose an employee")
    .regex(objectIdRegex, "Invalid employee id"),
  month: monthSchema,
  currency: currencySchema,
  gross: rupeeAmount,
  breakdown: z.array(breakdownItemSchema).optional(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .or(z.literal(""))
    .optional(),
});
export type GeneratePayslipValues = z.infer<typeof GeneratePayslipSchema>;
