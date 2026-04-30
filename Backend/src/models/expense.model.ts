import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// Amounts are stored as integers in the smallest currency unit (e.g. cents/paise).
// 100 = 1 unit (e.g. $1.00). For MVP we keep this as a plain Number; the convention
// is documented here so future code can move to bigint or a Money helper without
// breaking the wire format.
export const EXPENSE_CATEGORIES = [
  "TRAVEL",
  "MEALS",
  "SOFTWARE",
  "HARDWARE",
  "OFFICE",
  "TRAINING",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const CURRENCIES = ["USD", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

const expenseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      enum: CURRENCIES,
      default: "INR",
      uppercase: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    incurredOn: { type: Date, required: true },
    receiptUrl: { type: String, default: null },
    receiptKey: { type: String, select: false },
    status: {
      type: String,
      enum: EXPENSE_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },
    decisionById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decisionNote: { type: String, default: null, maxlength: 500 },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & {
  _id: Types.ObjectId;
};
export type ExpenseModel = Model<ExpenseDoc>;

export const Expense: ExpenseModel = model<ExpenseDoc>("Expense", expenseSchema);
