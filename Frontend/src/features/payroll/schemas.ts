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

export const breakdownItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(60, "Label must be 60 characters or fewer"),
  amount: z.coerce
    .number({ message: "Amount must be a number" })
    .int("Amount must be a whole number of cents")
    .nonnegative("Amount must be zero or greater"),
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
  gross: z.coerce
    .number({ message: "Gross must be a number" })
    .int("Gross must be a whole number of cents")
    .nonnegative("Gross must be zero or greater"),
  breakdown: z.array(breakdownItemSchema).optional(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .or(z.literal(""))
    .optional(),
});
export type GeneratePayslipValues = z.infer<typeof GeneratePayslipSchema>;
