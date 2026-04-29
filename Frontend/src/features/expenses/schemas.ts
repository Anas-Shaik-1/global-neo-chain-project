import { z } from "zod";
import { EXPENSE_CATEGORIES } from "./api/hooks";

export const currencySchema = z
  .string()
  .length(3, "3-letter currency code")
  .regex(/^[A-Z]{3}$/, "ISO 4217 (uppercase)");

export const SubmitExpenseSchema = z.object({
  amount: z.coerce
    .number({ message: "Amount must be a number" })
    .int("Amount must be a whole number of cents")
    .positive("Amount must be greater than zero"),
  currency: currencySchema,
  category: z.enum(EXPENSE_CATEGORIES),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be 500 characters or fewer"),
  incurredOn: z.coerce
    .date({ message: "Pick a valid date" })
    .max(new Date(Date.now() + 86_400_000), "Date can't be in the future"),
});
export type SubmitExpenseValues = z.infer<typeof SubmitExpenseSchema>;

export const ExpenseDecideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z
    .string()
    .max(500, "Note must be 500 characters or fewer")
    .or(z.literal(""))
    .optional(),
});
export type ExpenseDecideValues = z.infer<typeof ExpenseDecideSchema>;
