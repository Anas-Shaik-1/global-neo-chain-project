import PDFDocument from "pdfkit";
import { Resume, type ResumeDoc } from "../../models/resume.model.js";
import { User } from "../../models/user.model.js";
import { NotFoundError } from "../../lib/errors.js";
import type { ResumeBodyType } from "./resume.schema.js";

/**
 * Hydrate a fresh resume from the user's profile so first-time editors
 * land on a populated form instead of an empty page. Idempotent — only
 * fills blank fields. Used by both `getMyResume` (auto-create on first
 * load) and the PDF endpoint (so a never-saved user can still print).
 */
async function ensureSeeded(userId: string): Promise<ResumeDoc & { _id: unknown }> {
  let doc = await Resume.findOne({ userId });
  if (doc) return doc as ResumeDoc & { _id: unknown };
  const user = await User.findById(userId).select(
    "name email phone jobTitle bio",
  );
  doc = await Resume.create({
    userId,
    fullName: user?.name ?? "",
    headline: user?.jobTitle ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    summary: user?.bio ?? "",
  });
  return doc as ResumeDoc & { _id: unknown };
}

export async function getMyResume(userId: string) {
  const doc = await ensureSeeded(userId);
  return serialize(doc);
}

export async function saveMyResume(userId: string, body: ResumeBodyType) {
  // Upsert by userId so a save before the first GET still works.
  const doc = await Resume.findOneAndUpdate(
    { userId },
    { ...body, userId },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (!doc) throw new NotFoundError("Resume save failed");
  return serialize(doc as ResumeDoc & { _id: unknown });
}

interface SerializedResume {
  id: string;
  userId: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
  summary: string;
  experience: ResumeDoc["experience"];
  education: ResumeDoc["education"];
  skills: ResumeDoc["skills"];
  projects: ResumeDoc["projects"];
  certifications: ResumeDoc["certifications"];
  languages: ResumeDoc["languages"];
  template: ResumeDoc["template"];
  updatedAt?: string;
}

function serialize(doc: ResumeDoc & { _id: unknown }): SerializedResume {
  const obj = doc as unknown as ResumeDoc & {
    _id: { toString(): string };
    userId: { toString(): string };
    updatedAt?: Date;
  };
  return {
    id: obj._id.toString(),
    userId: obj.userId.toString(),
    fullName: obj.fullName ?? "",
    headline: obj.headline ?? "",
    email: obj.email ?? "",
    phone: obj.phone ?? "",
    location: obj.location ?? "",
    links: obj.links ?? [],
    summary: obj.summary ?? "",
    experience: obj.experience ?? [],
    education: obj.education ?? [],
    skills: obj.skills ?? [],
    projects: obj.projects ?? [],
    certifications: obj.certifications ?? [],
    languages: obj.languages ?? [],
    template: obj.template ?? "minimal",
    updatedAt: obj.updatedAt?.toISOString(),
  };
}

// ─── PDF generation ──────────────────────────────────────────────────────

const COLORS = {
  ink: "#0e1014",
  text: "#1f2530",
  muted: "#5c6573",
  rule: "#d8dde6",
  accent: "#2563eb",
};

/**
 * Render the user's resume to a PDF buffer. Three layouts, picked by
 * the user's `template` choice:
 *   - `minimal`  : single column with a blue accent rule under each
 *                  section heading (default).
 *   - `modern`   : full-width blue header band + tinted left sidebar
 *                  (contact / skills / languages / certs).
 *   - `compact`  : dense single column, smaller fonts, inline section
 *                  labels, no decorative rules — fits more on one page.
 */
export async function generateResumePdf(userId: string): Promise<Buffer> {
  const r = await getMyResume(userId);
  return new Promise<Buffer>((resolve, reject) => {
    // Margins differ per template: compact uses tighter margins for
    // density; minimal and modern share the roomy default.
    const margins =
      r.template === "compact"
        ? { top: 40, left: 44, right: 44, bottom: 40 }
        : { top: 56, left: 56, right: 56, bottom: 56 };
    const doc = new PDFDocument({
      size: "A4",
      margins,
      info: {
        Title: `${r.fullName || "Resume"} — Resume`,
        Author: r.fullName || "Global NeoChain",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (b) => chunks.push(b as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (r.template === "modern") {
      renderModern(doc, r);
    } else if (r.template === "compact") {
      renderCompact(doc, r);
    } else {
      renderMinimal(doc, r);
    }

    doc.end();
  });
}

// ─── Minimal (default) ───────────────────────────────────────────────────

function renderMinimal(doc: Doc, r: SerializedResume) {
  drawHeader(doc, r);
  if (r.summary) drawSection(doc, "Summary", () => drawParagraph(doc, r.summary));
  if (r.experience.length) drawSection(doc, "Experience", () => drawExperience(doc, r.experience));
  if (r.projects.length) drawSection(doc, "Projects", () => drawProjects(doc, r.projects));
  if (r.education.length) drawSection(doc, "Education", () => drawEducation(doc, r.education));
  if (r.skills.length) drawSection(doc, "Skills", () => drawSkills(doc, r.skills));
  if (r.certifications.length) drawSection(doc, "Certifications", () => drawCerts(doc, r.certifications));
  if (r.languages.length) drawSection(doc, "Languages", () => drawLanguages(doc, r.languages));
}

// ─── Modern (editorial header + asymmetric two-column body) ──────────────

function renderModern(doc: Doc, r: SerializedResume) {
  const pageW = doc.page.width;
  const ml = doc.page.margins.left;
  const mr = doc.page.margins.right;
  const mt = doc.page.margins.top;
  const contentW = pageW - ml - mr;

  // ── Editorial header — full width, accent rule beneath ─────────────
  // Name on the left, contact stack on the right, separated visually
  // by a 1.5px accent rule. No color blocks.
  const headerTop = mt;
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text(r.fullName || "Your Name", ml, headerTop, {
      width: contentW * 0.62,
    });
  let nameBottom = doc.y;
  if (r.headline) {
    doc
      .moveDown(0.05)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLORS.accent)
      .text(r.headline, ml, doc.y, { width: contentW * 0.62 });
    nameBottom = doc.y;
  }

  // Right-aligned contact stack on the same band as the name.
  const contactX = ml + contentW * 0.62 + 16;
  const contactW = contentW - (contactX - ml);
  let cy = headerTop + 4;
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted);
  for (const v of [r.email, r.phone, r.location].filter(Boolean)) {
    doc.text(v, contactX, cy, { width: contactW, align: "right" });
    cy = doc.y;
  }
  for (const l of r.links.filter((l) => l.url).slice(0, 3)) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(`${l.label || "link"}  `, contactX, cy, {
        width: contactW,
        align: "right",
        continued: true,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(l.url);
    cy = doc.y;
  }
  const headerBottom = Math.max(nameBottom, cy);

  // Accent rule under the header.
  doc
    .strokeColor(COLORS.accent)
    .lineWidth(1.5)
    .moveTo(ml, headerBottom + 10)
    .lineTo(pageW - mr, headerBottom + 10)
    .stroke();

  // ── Two-column body ─────────────────────────────────────────────────
  const bodyTop = headerBottom + 28;
  // Wide main on the left (~62%), narrow sidebar on the right (~32%),
  // with a 6% gap between. Mirrors the FE preview.
  const mainW = Math.round(contentW * 0.62);
  const gap = Math.round(contentW * 0.06);
  const sidebarX = ml + mainW + gap;
  const sidebarW = pageW - mr - sidebarX;

  // Hairline divider between columns, full body height — drawn first
  // so subsequent text writes paint over it cleanly if anything sits
  // exactly on the line.
  doc
    .strokeColor(COLORS.rule)
    .lineWidth(0.6)
    .moveTo(sidebarX - gap / 2, bodyTop)
    .lineTo(sidebarX - gap / 2, doc.page.height - doc.page.margins.bottom)
    .stroke();

  // Main column — narrative sections.
  doc.x = ml;
  doc.y = bodyTop;
  if (r.summary) {
    drawModernHeading(doc, "Profile", ml, mainW);
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(COLORS.text)
      .text(r.summary, ml, doc.y, { width: mainW, lineGap: 2 });
    doc.moveDown(0.7);
  }
  if (r.experience.length) {
    drawModernHeading(doc, "Experience", ml, mainW);
    drawExperienceCol(doc, r.experience, ml, mainW);
  }
  if (r.projects.length) {
    drawModernHeading(doc, "Projects", ml, mainW);
    drawProjectsCol(doc, r.projects, ml, mainW);
  }
  if (r.education.length) {
    drawModernHeading(doc, "Education", ml, mainW);
    drawEducationCol(doc, r.education, ml, mainW);
  }
  const mainBottom = doc.y;

  // Sidebar — scannable blocks (skills / certs / languages).
  doc.x = sidebarX;
  doc.y = bodyTop;
  if (r.skills.length) {
    drawModernHeading(doc, "Skills", sidebarX, sidebarW);
    for (const g of r.skills.filter((g) => g.items.length)) {
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.ink)
        .text(g.group || "Skills", sidebarX, doc.y, { width: sidebarW });
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#3a4150")
        .text(g.items.join(" · "), sidebarX, doc.y, {
          width: sidebarW,
          lineGap: 1,
        });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.3);
  }
  if (r.certifications.length) {
    drawModernHeading(doc, "Certifications", sidebarX, sidebarW);
    for (const c of r.certifications) {
      if (c.name) {
        doc
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor(COLORS.ink)
          .text(c.name, sidebarX, doc.y, { width: sidebarW });
      }
      const sub = [c.issuer, c.year].filter(Boolean).join(" · ");
      if (sub) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(sub, sidebarX, doc.y, { width: sidebarW });
      }
      doc.moveDown(0.25);
    }
    doc.moveDown(0.3);
  }
  if (r.languages.length) {
    drawModernHeading(doc, "Languages", sidebarX, sidebarW);
    for (const l of r.languages.filter((l) => l.name)) {
      const startY = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.ink)
        .text(l.name, sidebarX, startY, { width: sidebarW * 0.6 });
      if (l.proficiency) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(l.proficiency, sidebarX, startY, {
            width: sidebarW,
            align: "right",
          });
      }
      doc.moveDown(0.1);
    }
  }

  // Reset y to whichever column ended up taller so any future page
  // additions keep flowing naturally.
  doc.y = Math.max(mainBottom, doc.y);
}

/**
 * Modern section heading — small caps with a 4px accent square to the
 * left, no rule beneath. Replaces the heavier all-caps block heading
 * the previous design used.
 */
function drawModernHeading(doc: Doc, title: string, x: number, width: number) {
  const startY = doc.y;
  // Small accent square 6×6 just left of the heading text. Drawn on a
  // separate baseline so it doesn't get caught up in pdfkit's text flow.
  doc.rect(x, startY + 4, 5, 5).fill(COLORS.accent);
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(title.toUpperCase(), x + 10, startY, {
      characterSpacing: 1.6,
      width: width - 10,
    });
  doc.moveDown(0.55);
}

function drawExperienceCol(doc: Doc, items: SerializedResume["experience"], x: number, width: number) {
  for (const it of items) {
    drawTwoColAt(
      doc,
      `${it.role || ""}${it.company ? ` · ${it.company}` : ""}`,
      formatRange(it.startDate, it.endDate, it.current),
      x,
      width,
    );
    if (it.location) {
      doc.font("Helvetica-Oblique").fontSize(10).fillColor(COLORS.muted)
        .text(it.location, x, doc.y, { width });
    }
    if (it.bullets?.length) {
      doc.moveDown(0.15);
      for (const b of it.bullets) {
        doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text)
          .text(`• ${b}`, x + 8, doc.y, { width: width - 8, lineGap: 1.5 });
      }
    }
    doc.moveDown(0.5);
  }
}

function drawProjectsCol(doc: Doc, items: SerializedResume["projects"], x: number, width: number) {
  for (const p of items) {
    drawTwoColAt(doc, `${p.name || ""}${p.role ? ` · ${p.role}` : ""}`, p.year, x, width);
    if (p.body) {
      doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text)
        .text(p.body, x, doc.y, { width, lineGap: 1.5 });
    }
    if (p.links?.length) {
      const linkLine = p.links.filter((l) => l.url).map((l) => `${l.label || "link"}: ${l.url}`).join("  ·  ");
      if (linkLine) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted)
          .text(linkLine, x, doc.y, { width });
      }
    }
    doc.moveDown(0.5);
  }
}

function drawEducationCol(doc: Doc, items: SerializedResume["education"], x: number, width: number) {
  for (const e of items) {
    const left = [e.degree, e.field].filter(Boolean).join(" — ");
    drawTwoColAt(doc, left || e.institution, formatRange(e.startDate, e.endDate, e.current), x, width);
    if (e.institution && left) {
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted)
        .text(e.institution, x, doc.y, { width });
    }
    if (e.notes) {
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.text)
        .text(e.notes, x, doc.y, { width });
    }
    doc.moveDown(0.4);
  }
}

function drawTwoColAt(doc: Doc, left: string, right: string, x: number, width: number) {
  if (!left && !right) return;
  const startY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink)
    .text(left, x, startY, { width: width - 110, continued: false });
  if (right) {
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted)
      .text(right, x, startY, { width, align: "right" });
  }
  doc.moveDown(0.05);
}

// ─── Compact (dense single column) ───────────────────────────────────────

function renderCompact(doc: Doc, r: SerializedResume) {
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(r.fullName || "Your Name", { continued: !!r.headline });
  if (r.headline) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(COLORS.accent)
      .text(`  ·  ${r.headline}`);
  }
  const contactBits = [r.email, r.phone, r.location].filter(Boolean);
  const linkLine = r.links.filter((l) => l.url).map((l) => `${l.label || "link"}: ${l.url}`).join("  ·  ");
  const headerLine = [...contactBits, linkLine].filter(Boolean).join("  ·  ");
  if (headerLine) {
    doc.moveDown(0.1).font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(headerLine);
  }
  doc.moveDown(0.3);
  rule(doc);
  doc.moveDown(0.4);

  const inline = (title: string, body: () => void) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.accent)
      .text(title.toUpperCase(), { characterSpacing: 1.2, continued: true });
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text).text("   ", { continued: true });
    body();
    doc.moveDown(0.35);
  };

  if (r.summary) {
    inline("Summary", () => doc.text(r.summary));
  }
  if (r.experience.length) {
    inline("Experience", () => doc.text(""));
    for (const e of r.experience) {
      drawTwoCol(
        doc,
        `${e.role || ""}${e.company ? ` · ${e.company}` : ""}`,
        formatRange(e.startDate, e.endDate, e.current),
      );
      const bullets = e.bullets.filter(Boolean);
      if (bullets.length) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text)
          .text(bullets.map((b) => `• ${b}`).join("\n"), { lineGap: 0.5 });
      }
      doc.moveDown(0.2);
    }
  }
  if (r.projects.length) {
    inline("Projects", () => doc.text(""));
    for (const p of r.projects) {
      drawTwoCol(doc, `${p.name || ""}${p.role ? ` · ${p.role}` : ""}`, p.year);
      if (p.body) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text).text(p.body, { lineGap: 0.5 });
      }
      doc.moveDown(0.15);
    }
  }
  if (r.education.length) {
    inline("Education", () => doc.text(""));
    for (const e of r.education) {
      const left = [e.degree, e.field].filter(Boolean).join(" — ");
      drawTwoCol(doc, left || e.institution, formatRange(e.startDate, e.endDate, e.current));
      if (left && e.institution) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted).text(e.institution);
      }
      if (e.notes) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text).text(e.notes);
      }
      doc.moveDown(0.15);
    }
  }
  if (r.skills.length) {
    inline("Skills", () => {
      const txt = r.skills
        .filter((g) => g.items.length)
        .map((g) => `${g.group || "Skills"}: ${g.items.join(" · ")}`)
        .join("    ");
      doc.text(txt);
    });
  }
  if (r.certifications.length) {
    inline("Certifications", () => {
      const txt = r.certifications
        .filter((c) => c.name)
        .map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(" — "))
        .join(" · ");
      doc.text(txt);
    });
  }
  if (r.languages.length) {
    inline("Languages", () => {
      const txt = r.languages
        .filter((l) => l.name)
        .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name))
        .join(" · ");
      doc.text(txt);
    });
  }
}

type Doc = PDFKit.PDFDocument;

function drawHeader(doc: Doc, r: SerializedResume) {
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(r.fullName || "Your Name", { continued: false });
  if (r.headline) {
    doc
      .moveDown(0.15)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLORS.accent)
      .text(r.headline);
  }
  const contactBits: string[] = [];
  if (r.email) contactBits.push(r.email);
  if (r.phone) contactBits.push(r.phone);
  if (r.location) contactBits.push(r.location);
  if (contactBits.length) {
    doc
      .moveDown(0.35)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(contactBits.join("  ·  "));
  }
  if (r.links.length) {
    const linkLine = r.links
      .filter((l) => l.url)
      .map((l) => `${l.label || "link"}: ${l.url}`)
      .join("  ·  ");
    if (linkLine) {
      doc
        .moveDown(0.15)
        .fillColor(COLORS.muted)
        .text(linkLine);
    }
  }
  doc.moveDown(0.6);
  rule(doc);
  doc.moveDown(0.6);
}

function drawSection(doc: Doc, title: string, body: () => void) {
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(title.toUpperCase(), { characterSpacing: 1.6 });
  doc.moveDown(0.25);
  doc
    .strokeColor(COLORS.accent)
    .lineWidth(1.2)
    .moveTo(doc.x, doc.y)
    .lineTo(doc.x + 36, doc.y)
    .stroke();
  doc.moveDown(0.5);
  body();
  doc.moveDown(0.7);
}

function drawParagraph(doc: Doc, text: string) {
  doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text).text(text, {
    paragraphGap: 4,
    lineGap: 2,
  });
}

function drawExperience(doc: Doc, items: SerializedResume["experience"]) {
  for (const it of items) {
    drawTwoCol(
      doc,
      `${it.role || ""}${it.company ? ` · ${it.company}` : ""}`,
      formatRange(it.startDate, it.endDate, it.current),
    );
    if (it.location) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor(COLORS.muted)
        .text(it.location);
    }
    if (it.bullets?.length) {
      doc.moveDown(0.15);
      for (const b of it.bullets) {
        doc
          .font("Helvetica")
          .fontSize(10.5)
          .fillColor(COLORS.text)
          .text(`• ${b}`, { indent: 8, lineGap: 1.5 });
      }
    }
    doc.moveDown(0.4);
  }
}

function drawProjects(doc: Doc, items: SerializedResume["projects"]) {
  for (const p of items) {
    drawTwoCol(doc, `${p.name || ""}${p.role ? ` · ${p.role}` : ""}`, p.year);
    if (p.body) {
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(COLORS.text)
        .text(p.body, { lineGap: 1.5 });
    }
    if (p.links?.length) {
      const linkLine = p.links
        .filter((l) => l.url)
        .map((l) => `${l.label || "link"}: ${l.url}`)
        .join("  ·  ");
      if (linkLine) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted).text(linkLine);
      }
    }
    doc.moveDown(0.4);
  }
}

function drawEducation(doc: Doc, items: SerializedResume["education"]) {
  for (const e of items) {
    const left = [e.degree, e.field].filter(Boolean).join(" — ");
    drawTwoCol(doc, left || e.institution, formatRange(e.startDate, e.endDate, e.current));
    if (e.institution && left) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.muted)
        .text(e.institution);
    }
    if (e.notes) {
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.text).text(e.notes);
    }
    doc.moveDown(0.4);
  }
}

function drawSkills(doc: Doc, groups: SerializedResume["skills"]) {
  for (const g of groups) {
    if (!g.items?.length) continue;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(`${g.group || "Skills"}:`, { continued: true });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(`  ${g.items.join(" · ")}`);
    doc.moveDown(0.2);
  }
}

function drawCerts(doc: Doc, items: SerializedResume["certifications"]) {
  for (const c of items) {
    drawTwoCol(
      doc,
      `${c.name || ""}${c.issuer ? ` · ${c.issuer}` : ""}`,
      c.year,
    );
  }
}

function drawLanguages(doc: Doc, items: SerializedResume["languages"]) {
  const line = items
    .filter((l) => l.name)
    .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name))
    .join("  ·  ");
  doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text).text(line);
}

function drawTwoCol(doc: Doc, left: string, right: string) {
  if (!left && !right) return;
  const startY = doc.y;
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .font("Helvetica-Bold")
    .fontSize(11.5)
    .fillColor(COLORS.ink)
    .text(left, doc.page.margins.left, startY, {
      width: pageW - 110,
      continued: false,
    });
  if (right) {
    const rightY = startY;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(right, doc.page.margins.left, rightY, {
        width: pageW,
        align: "right",
      });
  }
  doc.moveDown(0.05);
}

function rule(doc: Doc) {
  const y = doc.y;
  doc
    .strokeColor(COLORS.rule)
    .lineWidth(0.6)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
}

function formatRange(start: string, end: string, current: boolean): string {
  const a = start || "";
  const b = current ? "Present" : end || "";
  if (a && b) return `${a} – ${b}`;
  return a || b;
}
