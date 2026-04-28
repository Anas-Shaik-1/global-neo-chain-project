import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// Amounts are stored as integers in the smallest currency unit (cents).
// 100 = 1.00. For MVP this is a plain Number; the convention keeps wire
// format stable if we ever migrate to bigint or a Money helper.
export const BREAKDOWN_KINDS = ["EARNING", "DEDUCTION"] as const;
export type BreakdownKind = (typeof BREAKDOWN_KINDS)[number];

const breakdownItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: BREAKDOWN_KINDS, required: true },
  },
  { _id: false },
);

const payslipSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    gross: { type: Number, required: true, min: 0 },
    breakdown: { type: [breakdownItemSchema], default: [] },
    netAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null, maxlength: 1000 },
    generatedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pdfKey: { type: String, default: null, select: false },
    pdfUrl: { type: String, default: null },
  },
  { timestamps: true },
);

// One payslip per user per month
payslipSchema.index({ userId: 1, month: 1 }, { unique: true });

export type PayslipDoc = InferSchemaType<typeof payslipSchema> & {
  _id: Types.ObjectId;
};
export type PayslipModel = Model<PayslipDoc>;

export const Payslip: PayslipModel = model<PayslipDoc>("Payslip", payslipSchema);
