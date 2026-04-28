import PDFDocument from "pdfkit";
import type { PayslipDoc, BreakdownKind } from "../models/payslip.model.js";
import type { UserDoc } from "../models/user.model.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatPeriod(month: string): string {
  // month is "YYYY-MM"
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return month;
  }
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

interface BreakdownItem {
  label: string;
  amount: number;
  kind: BreakdownKind;
}

export async function generatePayslipPdf(
  payslip: PayslipDoc,
  employee: Pick<UserDoc, "name" | "email" | "jobTitle">,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const currency = payslip.currency;
    const breakdown = (payslip.breakdown ?? []) as BreakdownItem[];
    const earnings = breakdown.filter((b) => b.kind === "EARNING");
    const deductions = breakdown.filter((b) => b.kind === "DEDUCTION");
    const earningsTotal =
      payslip.gross + earnings.reduce((s, e) => s + e.amount, 0);
    const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);

    // Header
    doc.fontSize(20).text("Global NeoChain — Payslip", { align: "center" });
    doc.moveDown(1);

    // Employee block
    doc.fontSize(11);
    doc.text(`Employee: ${employee.name}`);
    doc.text(`Email: ${employee.email}`);
    if (employee.jobTitle) {
      doc.text(`Job title: ${employee.jobTitle}`);
    }
    doc.moveDown(0.5);
    doc.text(`Period: ${formatPeriod(payslip.month)}`);
    doc.moveDown(1);

    // Earnings table
    doc.fontSize(13).text("Earnings", { underline: true });
    doc.fontSize(11);
    doc.moveDown(0.3);
    doc.text(`Gross: ${formatAmount(payslip.gross, currency)}`);
    for (const e of earnings) {
      doc.text(`${e.label}: ${formatAmount(e.amount, currency)}`);
    }
    doc.moveDown(0.2);
    doc
      .font("Helvetica-Bold")
      .text(`Total earnings: ${formatAmount(earningsTotal, currency)}`)
      .font("Helvetica");
    doc.moveDown(1);

    // Deductions table
    doc.fontSize(13).text("Deductions", { underline: true });
    doc.fontSize(11);
    doc.moveDown(0.3);
    if (deductions.length === 0) {
      doc.text("(none)");
    } else {
      for (const d of deductions) {
        doc.text(`${d.label}: ${formatAmount(d.amount, currency)}`);
      }
    }
    doc.moveDown(0.2);
    doc
      .font("Helvetica-Bold")
      .text(`Total deductions: ${formatAmount(deductionsTotal, currency)}`)
      .font("Helvetica");
    doc.moveDown(1);

    // Net
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(`Net amount: ${formatAmount(payslip.netAmount, currency)}`);
    doc.font("Helvetica").fontSize(11);

    if (payslip.notes) {
      doc.moveDown(1);
      doc.fontSize(13).text("Notes", { underline: true });
      doc.fontSize(11).moveDown(0.3);
      doc.text(payslip.notes);
    }

    // Footer
    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(
        `Generated on ${new Date().toISOString().slice(0, 10)} — Payslip ID: ${payslip._id.toString()}`,
        { align: "center" },
      )
      .fillColor("#000000");

    doc.end();
  });
}
