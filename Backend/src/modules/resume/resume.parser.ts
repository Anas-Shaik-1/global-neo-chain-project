import { PDFParse } from "pdf-parse";
import type { ResumeBodyType } from "./resume.schema.js";

/**
 * Best-effort parser that turns a chunk of pasted resume text (from a
 * PDF, LinkedIn export, plain markdown, etc.) into the same structured
 * shape the editor saves. The user is expected to review + edit the
 * extracted result on the form — this just gives them a head start.
 *
 * Approach: reliable extraction for header fields (name, email, phone,
 * location), then split the body by section headings and apply
 * section-specific heuristics for experience / education / skills /
 * projects / certifications / languages. Anything we can't confidently
 * parse comes through as raw `body`/`bullets` so nothing is lost.
 */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/;
const URL_RE = /\bhttps?:\/\/\S+/gi;

const SECTION_KEYWORDS: Record<string, RegExp> = {
  summary: /^(summary|profile|about|objective)\b/i,
  experience: /^(experience|work\s*experience|employment|professional\s*experience)\b/i,
  education: /^(education|academics?)\b/i,
  skills: /^(skills?|technical\s*skills?|tech\s*stack)\b/i,
  projects: /^(projects?|portfolio|side\s*projects?)\b/i,
  certifications: /^(certifications?|certificates?|courses?)\b/i,
  languages: /^(languages?)\b/i,
};

type Sections = Partial<Record<keyof typeof SECTION_KEYWORDS, string[]>>;

/**
 * Extract plain text from a PDF buffer using pdf-parse (pdfjs under the
 * hood). Image-only / scanned PDFs return little-to-no text — caller is
 * expected to surface a friendly "we couldn't read this" message in
 * that case rather than mis-parse a stray header into a name.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy().catch(() => {
      // pdfjs sometimes throws on destroy when the doc never finished
      // loading — safe to swallow; we've already taken the text we need.
    });
  }
}

export function parseResumeText(text: string): ResumeBodyType {
  const normalised = normalise(text);
  const lines = normalised.split("\n").map((l) => l.trimEnd());

  const header = extractHeader(normalised, lines);
  const sections = splitSections(lines);

  const exp = sections.experience
    ? parseExperience(sections.experience)
    : [];
  const edu = sections.education ? parseEducation(sections.education) : [];
  const skills = sections.skills ? parseSkills(sections.skills) : [];
  const projects = sections.projects ? parseProjects(sections.projects) : [];
  const certs = sections.certifications
    ? parseCertifications(sections.certifications)
    : [];
  const langs = sections.languages ? parseLanguages(sections.languages) : [];

  // Truncate any over-cap arrays so the value is safely re-validated by
  // the same Zod schema the form save uses (max 20 experience, max 10
  // education, etc.).
  return {
    fullName: header.name,
    headline: header.headline,
    email: header.email,
    phone: header.phone,
    location: header.location,
    links: header.links,
    summary: sections.summary
      ? sections.summary.join("\n").trim().slice(0, 800)
      : "",
    experience: exp.slice(0, 20),
    education: edu.slice(0, 10),
    skills: skills.slice(0, 10),
    projects: projects.slice(0, 20),
    certifications: certs.slice(0, 20),
    languages: langs.slice(0, 10),
    template: "minimal",
  };
}

function normalise(text: string): string {
  // Collapse weird whitespace, normalise line endings, strip nullish
  // characters that PDF copies sometimes carry.
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .trim();
}

interface Header {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
}

function extractHeader(text: string, lines: string[]): Header {
  const email = (text.match(EMAIL_RE)?.[0] ?? "").slice(0, 120);
  const phoneRaw = text.match(PHONE_RE)?.[0] ?? "";
  const phone = phoneRaw.replace(/\s+/g, " ").trim().slice(0, 30);

  const urls = Array.from(text.matchAll(URL_RE)).map((m) => m[0].replace(/[),.]+$/, ""));
  const links = uniqueByUrl(urls).slice(0, 6).map((url) => ({
    label: labelForUrl(url),
    url: url.slice(0, 200),
  }));

  // Name = first non-empty line that looks like a name (no @, no digits,
  // not too long). Resumes near-universally lead with it.
  const name = (lines.find(
    (l) => l && !EMAIL_RE.test(l) && !PHONE_RE.test(l) && !/[@/]/.test(l) && l.length <= 60 && /^[A-Za-z][A-Za-z .'-]+$/.test(l),
  ) ?? "").slice(0, 100);

  // Headline = next non-empty line after the name, if it isn't itself
  // contact data and isn't a section heading.
  let headline = "";
  if (name) {
    const idx = lines.findIndex((l) => l === name);
    for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
      const candidate = lines[i]?.trim() ?? "";
      if (!candidate) continue;
      if (EMAIL_RE.test(candidate) || PHONE_RE.test(candidate)) continue;
      if (isSectionHeading(candidate)) break;
      if (candidate.length > 120) continue;
      headline = candidate;
      break;
    }
  }

  // Location: heuristic — line that looks like "City, State" or "City,
  // Country" inside the first 8 non-empty lines.
  let location = "";
  const head = lines.filter(Boolean).slice(0, 8);
  for (const l of head) {
    if (/^[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+$/.test(l) && l.length <= 80) {
      location = l;
      break;
    }
  }

  return { name, headline, email, phone, location, links };
}

function uniqueByUrl(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function labelForUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin")) return "LinkedIn";
  if (u.includes("github")) return "GitHub";
  if (u.includes("twitter") || u.includes("x.com")) return "Twitter";
  if (u.includes("dribbble")) return "Dribbble";
  if (u.includes("behance")) return "Behance";
  return "Website";
}

function isSectionHeading(line: string): boolean {
  return Object.values(SECTION_KEYWORDS).some((re) => re.test(line.trim()));
}

function classifyHeading(line: string): keyof typeof SECTION_KEYWORDS | null {
  const trimmed = line.trim();
  for (const [key, re] of Object.entries(SECTION_KEYWORDS)) {
    if (re.test(trimmed)) return key as keyof typeof SECTION_KEYWORDS;
  }
  return null;
}

function splitSections(lines: string[]): Sections {
  const out: Sections = {};
  let current: keyof typeof SECTION_KEYWORDS | null = null;
  for (const line of lines) {
    const head = classifyHeading(line);
    if (head) {
      current = head;
      out[current] = out[current] ?? [];
      continue;
    }
    if (current) {
      out[current]!.push(line);
    }
  }
  // Trim trailing blanks in each section.
  for (const k of Object.keys(out) as (keyof typeof SECTION_KEYWORDS)[]) {
    while (out[k] && out[k]!.length && !out[k]!.at(-1)?.trim()) out[k]!.pop();
  }
  return out;
}

// ─── Section parsers ─────────────────────────────────────────────────────

const DATE_RANGE_RE = /\b((?:19|20)\d{2}(?:-\d{1,2})?|[A-Z][a-z]{2,8}\s+(?:19|20)\d{2})\s*[-–—to]+\s*((?:Present|Current|Now|Ongoing|(?:19|20)\d{2}(?:-\d{1,2})?|[A-Z][a-z]{2,8}\s+(?:19|20)\d{2}))\b/i;

interface ParsedExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

function chunkByBlankLines(lines: string[]): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (!l.trim()) {
      if (cur.length) {
        chunks.push(cur);
        cur = [];
      }
    } else {
      cur.push(l);
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function parseExperience(lines: string[]): ParsedExperience[] {
  const items: ParsedExperience[] = [];
  for (const chunk of chunkByBlankLines(lines)) {
    if (!chunk.length) continue;
    const headerLine = chunk[0]!.trim();
    const dateMatch = chunk.join(" ").match(DATE_RANGE_RE);
    const start = dateMatch?.[1] ?? "";
    const endRaw = dateMatch?.[2] ?? "";
    const current = /present|current|now|ongoing/i.test(endRaw);
    const end = current ? "" : endRaw;

    // Header is usually "Role at Company" / "Role · Company" / "Role |
    // Company" / "Role, Company" — take both halves when we can.
    let role = "";
    let company = "";
    const splitMatch = headerLine.split(/\s+(?:at|·|—|–|-|\||,)\s+/);
    if (splitMatch.length >= 2) {
      role = splitMatch[0]!.trim();
      company = splitMatch[1]!.trim();
    } else {
      role = headerLine;
    }
    // Strip any trailing date text from role/company.
    role = role.replace(DATE_RANGE_RE, "").trim();
    company = company.replace(DATE_RANGE_RE, "").trim();

    // Bullets: lines that start with •/-/* or look like sentences.
    const bullets = chunk
      .slice(1)
      .map((l) => l.replace(/^[\s•·*\-–—]+/, "").trim())
      .filter((l) => l && !DATE_RANGE_RE.test(l) && l.length <= 300)
      .slice(0, 12);

    items.push({
      role: role.slice(0, 100),
      company: company.slice(0, 100),
      location: "",
      startDate: start.slice(0, 20),
      endDate: end.slice(0, 20),
      current,
      bullets,
    });
  }
  return items;
}

interface ParsedEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  current: boolean;
  notes: string;
}

function parseEducation(lines: string[]): ParsedEducation[] {
  const items: ParsedEducation[] = [];
  for (const chunk of chunkByBlankLines(lines)) {
    if (!chunk.length) continue;
    const headerLine = chunk[0]!.trim();
    const dateMatch = chunk.join(" ").match(DATE_RANGE_RE);
    const start = dateMatch?.[1] ?? "";
    const endRaw = dateMatch?.[2] ?? "";
    const current = /present|current|ongoing/i.test(endRaw);
    const end = current ? "" : endRaw;

    let degree = "";
    let institution = "";
    const split = headerLine.split(/\s+(?:at|·|—|–|-|\||,)\s+/);
    if (split.length >= 2) {
      degree = split[0]!.trim();
      institution = split[1]!.trim();
    } else {
      institution = headerLine;
    }
    degree = degree.replace(DATE_RANGE_RE, "").trim();
    institution = institution.replace(DATE_RANGE_RE, "").trim();

    const notes = chunk
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !DATE_RANGE_RE.test(l))
      .join(" · ")
      .slice(0, 200);

    items.push({
      institution: institution.slice(0, 100),
      degree: degree.slice(0, 100),
      field: "",
      startDate: start.slice(0, 20),
      endDate: end.slice(0, 20),
      current,
      notes,
    });
  }
  return items;
}

interface ParsedSkillGroup {
  group: string;
  items: string[];
}

function parseSkills(lines: string[]): ParsedSkillGroup[] {
  const groups: ParsedSkillGroup[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // "Languages: TypeScript, Python, Go"
    const m = trimmed.match(/^([A-Za-z][A-Za-z &/]{2,40})\s*:\s*(.+)$/);
    if (m) {
      const items = m[2]!
        .split(/[,•·|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 30);
      if (items.length) groups.push({ group: m[1]!.trim().slice(0, 60), items });
    } else {
      // Loose comma-separated line: drop into an "Other" bucket.
      const items = trimmed
        .replace(/^[•·*\-–—]+\s*/, "")
        .split(/[,•·|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length) {
        const other = groups.find((g) => g.group === "Other");
        if (other) {
          other.items.push(...items);
          other.items = other.items.slice(0, 30);
        } else {
          groups.push({ group: "Other", items: items.slice(0, 30) });
        }
      }
    }
  }
  return groups;
}

interface ParsedProject {
  name: string;
  role: string;
  year: string;
  body: string;
  links: { label: string; url: string }[];
}

function parseProjects(lines: string[]): ParsedProject[] {
  const items: ParsedProject[] = [];
  for (const chunk of chunkByBlankLines(lines)) {
    if (!chunk.length) continue;
    const headerLine = chunk[0]!.trim();
    const yearMatch = headerLine.match(/\b((?:19|20)\d{2})\b/);
    const year = yearMatch?.[1] ?? "";
    const cleanHeader = headerLine.replace(DATE_RANGE_RE, "").replace(yearMatch?.[0] ?? "", "").trim();
    const split = cleanHeader.split(/\s+(?:·|—|–|-|\|)\s+/);
    const name = (split[0] ?? cleanHeader).slice(0, 100);
    const role = (split[1] ?? "").slice(0, 100);

    const restText = chunk.slice(1).join("\n").trim();
    const urls = Array.from(restText.matchAll(URL_RE)).map((m) => m[0]);
    const body = restText
      .replace(URL_RE, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);

    items.push({
      name,
      role,
      year: year.slice(0, 12),
      body,
      links: uniqueByUrl(urls)
        .slice(0, 3)
        .map((u) => ({ label: labelForUrl(u), url: u.slice(0, 200) })),
    });
  }
  return items;
}

interface ParsedCertification {
  name: string;
  issuer: string;
  year: string;
}

function parseCertifications(lines: string[]): ParsedCertification[] {
  const items: ParsedCertification[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[•·*\-–—]+\s*/, "").trim();
    if (!trimmed) continue;
    const yearMatch = trimmed.match(/\b((?:19|20)\d{2})\b/);
    const year = yearMatch?.[1] ?? "";
    const withoutYear = trimmed.replace(/[,()\-–—]\s*(?:19|20)\d{2}\b/g, "").trim();
    // "AWS Certified — Amazon" / "AWS Certified · Amazon"
    const split = withoutYear.split(/\s+(?:·|—|–|-|\|)\s+/);
    const name = (split[0] ?? withoutYear).slice(0, 120);
    const issuer = (split[1] ?? "").slice(0, 100);
    items.push({ name, issuer, year: year.slice(0, 12) });
  }
  return items;
}

interface ParsedLanguage {
  name: string;
  proficiency: string;
}

function parseLanguages(lines: string[]): ParsedLanguage[] {
  const text = lines.join("\n");
  const items: ParsedLanguage[] = [];
  // Split on commas / bullets / pipes. Each entry might be "English",
  // "English (Native)", or "English: Native" — handle all three.
  const tokens = text
    .split(/[,•·|\n]/)
    .map((t) => t.replace(/^[•·*\-–—]+\s*/, "").trim())
    .filter(Boolean);
  for (const t of tokens) {
    let name = t;
    let proficiency = "";
    const paren = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const colon = t.match(/^(.+?)\s*:\s*(.+)$/);
    if (paren) {
      name = paren[1]!.trim();
      proficiency = paren[2]!.trim();
    } else if (colon) {
      name = colon[1]!.trim();
      proficiency = colon[2]!.trim();
    }
    if (name) {
      items.push({
        name: name.slice(0, 40),
        proficiency: proficiency.slice(0, 30),
      });
    }
  }
  return items;
}
