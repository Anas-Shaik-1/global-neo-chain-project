import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { PayslipDoc, BreakdownKind } from "../models/payslip.model.js";
import type { UserDoc } from "../models/user.model.js";

// Registered company identity used on every official payslip. Updating the
// address or registered name? Change it here — every payslip and any future
// official PDF (offer letters, etc.) should consume from this single block.
const COMPANY = {
  legalName: "M/S. Global NeoChain Solutions",
  brandName: "Global NeoChain",
  addressLines: [
    "Block-4, Port View Apartments, G4B,",
    "Harinathpuram, Nellore,",
    "Andhra Pradesh - 524003, India",
  ],
} as const;

// Brand palette (matches Frontend `--primary` HSL 195 90% 55%).
const COLOR_PRIMARY = "#1AAEDB";
const COLOR_PRIMARY_DEEP = "#0B7FA8";
const COLOR_INK = "#0F1A2A";
const COLOR_MUTED = "#6B7785";
const COLOR_BORDER = "#E2E8F0";
const COLOR_ROW_ALT = "#F7FAFC";
const COLOR_NET_BG = "#0F1A2A";
const COLOR_NET_FG = "#FFFFFF";

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

// Resolve and cache the logo bytes once at module load. Using sync I/O on
// boot is fine — the file is small and only loaded the first time the
// payroll service generates a PDF.
let LOGO_BYTES: Buffer | null = null;
try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // From dist/lib/pdf.js → ../../src/assets is the repo source.
  // From src/lib/pdf.ts (tsx) → ../assets works directly.
  const candidates = [
    path.resolve(here, "../assets/logo.png"),
    path.resolve(here, "../../src/assets/logo.png"),
  ];
  for (const p of candidates) {
    try {
      LOGO_BYTES = readFileSync(p);
      break;
    } catch {
      // try next candidate
    }
  }
} catch {
  LOGO_BYTES = null;
}

function formatPeriod(month: string): string {
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return month;
  }
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function formatAmount(cents: number, currency: string): string {
  // Locale-aware grouping for readability; currency code suffix.
  const value = (cents / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} ${currency}`;
}

interface BreakdownItem {
  label: string;
  amount: number;
  kind: BreakdownKind;
}

export interface CompanyContact {
  /** Display name of the admin who should be reached for queries. */
  adminName: string | null;
  /** Phone number, displayed verbatim. */
  adminPhone: string | null;
  /** Email — usually a generic finance@... but admins work too. */
  adminEmail: string | null;
}

export async function generatePayslipPdf(
  payslip: PayslipDoc,
  employee: Pick<UserDoc, "name" | "email" | "jobTitle">,
  contact: CompanyContact = { adminName: null, adminPhone: null, adminEmail: null },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0, // we manage our own gutters
    info: {
      Title: `Payslip ${payslip.month}`,
      Author: "Global NeoChain",
      Subject: `Payslip for ${employee.name} — ${formatPeriod(payslip.month)}`,
    },
  });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_WIDTH = doc.page.width;
    const PAGE_HEIGHT = doc.page.height;
    const SIDE_GUTTER = 48;
    const CONTENT_W = PAGE_WIDTH - SIDE_GUTTER * 2;

    const currency = payslip.currency;
    const breakdown = (payslip.breakdown ?? []) as BreakdownItem[];
    const earnings = breakdown.filter((b) => b.kind === "EARNING");
    const deductions = breakdown.filter((b) => b.kind === "DEDUCTION");
    const earningsTotal =
      payslip.gross + earnings.reduce((s, e) => s + e.amount, 0);
    const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);

    // ─── Header band ──────────────────────────────────────────────────────
    // The header is taller than v1 to fit the registered legal address — the
    // standard for any payroll document of record. Layout is logo → company
    // name + address (left, vertical) and PAYSLIP + period (right). No
    // marketing tagline; this is a financial document, not a brand brochure.
    const HEADER_H = 132;
    doc.rect(0, 0, PAGE_WIDTH, HEADER_H).fill(COLOR_PRIMARY);
    doc.fillColor(COLOR_NET_FG);

    const LOGO_BOX = 56;
    const LOGO_TOP = 24;
    if (LOGO_BYTES) {
      doc.image(LOGO_BYTES, SIDE_GUTTER, LOGO_TOP, {
        fit: [LOGO_BOX, LOGO_BOX],
      });
    } else {
      // Fallback monogram block if the asset isn't shipped.
      doc
        .roundedRect(SIDE_GUTTER, LOGO_TOP, LOGO_BOX, LOGO_BOX, 8)
        .fillAndStroke(COLOR_NET_FG, COLOR_NET_FG);
      doc
        .fillColor(COLOR_PRIMARY)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("GN", SIDE_GUTTER, LOGO_TOP + 14, {
          width: LOGO_BOX,
          align: "center",
        })
        .fillColor(COLOR_NET_FG);
    }

    // Company block — legal name first, then registered address, all
    // left-aligned next to the logo. Stays inside the header band.
    const COMPANY_X = SIDE_GUTTER + LOGO_BOX + 16;
    const COMPANY_W = PAGE_WIDTH - COMPANY_X - SIDE_GUTTER - 180;
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(COLOR_NET_FG)
      .text(COMPANY.legalName, COMPANY_X, LOGO_TOP, {
        width: COMPANY_W,
      });
    let addrCursor = LOGO_TOP + 22;
    doc.font("Helvetica").fontSize(9.5).fillColor("#E6F4FA");
    for (const line of COMPANY.addressLines) {
      doc.text(line, COMPANY_X, addrCursor, { width: COMPANY_W });
      addrCursor += 12;
    }

    // Right-aligned: PAYSLIP label + period.
    const RIGHT_X = PAGE_WIDTH - SIDE_GUTTER - 180;
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(COLOR_NET_FG)
      .text("PAYSLIP", RIGHT_X, LOGO_TOP, {
        width: 180,
        align: "right",
        characterSpacing: 2,
      });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#E6F4FA")
      .text(formatPeriod(payslip.month), RIGHT_X, LOGO_TOP + 28, {
        width: 180,
        align: "right",
      });

    // ─── Employee info card ───────────────────────────────────────────────
    const cardY = HEADER_H + 28;
    const cardH = 88;
    doc
      .roundedRect(SIDE_GUTTER, cardY, CONTENT_W, cardH, 8)
      .fillAndStroke("#FFFFFF", COLOR_BORDER);

    function infoCell(
      label: string,
      value: string,
      x: number,
      y: number,
      w: number,
    ) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLOR_MUTED)
        .text(label.toUpperCase(), x, y, {
          width: w,
          characterSpacing: 0.6,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(COLOR_INK)
        .text(value || "—", x, y + 13, { width: w });
    }

    const colW = (CONTENT_W - 32) / 3;
    infoCell("Employee", employee.name, SIDE_GUTTER + 16, cardY + 16, colW);
    infoCell("Email", employee.email, SIDE_GUTTER + 16 + colW + 16, cardY + 16, colW);
    infoCell(
      "Job title",
      employee.jobTitle ?? "—",
      SIDE_GUTTER + 16 + (colW + 16) * 2,
      cardY + 16,
      colW,
    );
    infoCell(
      "Pay period",
      formatPeriod(payslip.month),
      SIDE_GUTTER + 16,
      cardY + 50,
      colW,
    );
    infoCell("Currency", currency, SIDE_GUTTER + 16 + colW + 16, cardY + 50, colW);
    infoCell(
      "Payslip ID",
      payslip._id.toString().slice(-12),
      SIDE_GUTTER + 16 + (colW + 16) * 2,
      cardY + 50,
      colW,
    );

    // ─── Earnings + deductions tables ────────────────────────────────────
    let cursorY = cardY + cardH + 24;

    function sectionHeader(title: string) {
      doc.fillColor(COLOR_PRIMARY_DEEP);
      doc.font("Helvetica-Bold").fontSize(12).text(title, SIDE_GUTTER, cursorY, {
        width: CONTENT_W,
        characterSpacing: 0.5,
      });
      cursorY += 18;
      doc
        .moveTo(SIDE_GUTTER, cursorY)
        .lineTo(SIDE_GUTTER + CONTENT_W, cursorY)
        .strokeColor(COLOR_BORDER)
        .lineWidth(1)
        .stroke();
      cursorY += 8;
    }

    function tableRow(
      label: string,
      amount: string,
      opts: { bold?: boolean; alt?: boolean } = {},
    ) {
      const ROW_H = 22;
      if (opts.alt) {
        doc.rect(SIDE_GUTTER, cursorY - 4, CONTENT_W, ROW_H).fill(COLOR_ROW_ALT);
      }
      doc
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10.5)
        .fillColor(opts.bold ? COLOR_INK : COLOR_INK)
        .text(label, SIDE_GUTTER + 12, cursorY, {
          width: CONTENT_W - 24 - 140,
        });
      doc
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10.5)
        .text(amount, SIDE_GUTTER + CONTENT_W - 152, cursorY, {
          width: 140,
          align: "right",
        });
      cursorY += ROW_H;
    }

    sectionHeader("Earnings");
    tableRow("Basic / Gross", formatAmount(payslip.gross, currency));
    earnings.forEach((e, i) => {
      tableRow(e.label, `+ ${formatAmount(e.amount, currency)}`, {
        alt: i % 2 === 0,
      });
    });
    cursorY += 4;
    doc
      .moveTo(SIDE_GUTTER, cursorY)
      .lineTo(SIDE_GUTTER + CONTENT_W, cursorY)
      .strokeColor(COLOR_BORDER)
      .stroke();
    cursorY += 8;
    tableRow(
      "Total earnings",
      formatAmount(earningsTotal, currency),
      { bold: true },
    );

    cursorY += 16;
    sectionHeader("Deductions");
    if (deductions.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(COLOR_MUTED)
        .text("No deductions for this period.", SIDE_GUTTER + 12, cursorY);
      cursorY += 22;
    } else {
      deductions.forEach((d, i) => {
        tableRow(d.label, `- ${formatAmount(d.amount, currency)}`, {
          alt: i % 2 === 0,
        });
      });
    }
    cursorY += 4;
    doc
      .moveTo(SIDE_GUTTER, cursorY)
      .lineTo(SIDE_GUTTER + CONTENT_W, cursorY)
      .strokeColor(COLOR_BORDER)
      .stroke();
    cursorY += 8;
    tableRow(
      "Total deductions",
      formatAmount(deductionsTotal, currency),
      { bold: true },
    );

    // ─── Net pay highlight ────────────────────────────────────────────────
    cursorY += 24;
    const NET_H = 72;
    doc
      .roundedRect(SIDE_GUTTER, cursorY, CONTENT_W, NET_H, 8)
      .fill(COLOR_NET_BG);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#9CB0C5")
      .text("NET PAY", SIDE_GUTTER + 24, cursorY + 16, {
        characterSpacing: 1.5,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor(COLOR_NET_FG)
      .text(
        formatAmount(payslip.netAmount, currency),
        SIDE_GUTTER + 24,
        cursorY + 30,
        {
          width: CONTENT_W - 48,
          align: "right",
        },
      );
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#9CB0C5")
      .text(
        `For ${formatPeriod(payslip.month)}`,
        SIDE_GUTTER + 24,
        cursorY + 50,
      );
    cursorY += NET_H + 24;

    // ─── Notes ────────────────────────────────────────────────────────────
    if (payslip.notes) {
      sectionHeader("Notes");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLOR_INK)
        .text(payslip.notes, SIDE_GUTTER + 12, cursorY, {
          width: CONTENT_W - 24,
          align: "left",
        });
      cursorY += doc.heightOfString(payslip.notes, {
        width: CONTENT_W - 24,
      });
    }

    // ─── Footer (anchored to bottom) ──────────────────────────────────────
    // Three lines: confidentiality notice, contact (admin name + phone +
    // email when available), and the document-id stamp. All muted so the
    // financial figures above stay the visual centre of gravity.
    const FOOTER_Y = PAGE_HEIGHT - 76;
    doc
      .moveTo(SIDE_GUTTER, FOOTER_Y - 12)
      .lineTo(SIDE_GUTTER + CONTENT_W, FOOTER_Y - 12)
      .strokeColor(COLOR_BORDER)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(
        `${COMPANY.legalName} · Confidential · This is a computer-generated payslip and does not require a signature.`,
        SIDE_GUTTER,
        FOOTER_Y,
        { width: CONTENT_W, align: "left" },
      );

    const contactBits: string[] = [];
    if (contact.adminName) contactBits.push(`Contact: ${contact.adminName}`);
    if (contact.adminPhone) contactBits.push(contact.adminPhone);
    if (contact.adminEmail) contactBits.push(contact.adminEmail);
    if (contactBits.length > 0) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLOR_MUTED)
        .text(contactBits.join(" · "), SIDE_GUTTER, FOOTER_Y + 14, {
          width: CONTENT_W,
          align: "left",
        });
    }

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(
        `Generated ${new Date().toISOString().slice(0, 10)} · ID ${payslip._id.toString()}`,
        SIDE_GUTTER,
        FOOTER_Y + (contactBits.length > 0 ? 28 : 14),
        { width: CONTENT_W, align: "left" },
      );

    doc.end();
  });
}
