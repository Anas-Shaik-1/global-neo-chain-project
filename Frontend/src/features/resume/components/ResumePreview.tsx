import type { ResumeInput, ResumeTemplate } from "../api/hooks";

/**
 * Live-preview of the resume — mirrors the backend PDF layout closely
 * enough that what the user sees here matches what they download.
 *
 * Three distinct templates, each picked via `resume.template`:
 *   - **minimal** : single column, blue accent rule under section heads,
 *                   editorial spacing — the default.
 *   - **modern**  : two-column with a tinted sidebar (contact / skills /
 *                   languages / certs) and a bolder header band.
 *   - **compact** : dense single-column, smaller type, no accent rules,
 *                   designed to fit more on one page.
 *
 * Renders on a white A4 sheet (light surface) inside the dark app shell —
 * printed resumes are light, and the preview should read like a
 * print-ready document, not an app screen.
 */
export function ResumePreview({ resume }: { resume: ResumeInput }) {
  const template: ResumeTemplate = resume.template ?? "minimal";
  return (
    <div className="rounded-md border border-white/10 bg-neutral-200/40 p-4 shadow-inner">
      <div
        className="mx-auto bg-white text-neutral-900 shadow-2xl shadow-black/40"
        style={{
          aspectRatio: "1 / 1.414",
          fontFamily: '"DM Sans", "Inter", sans-serif',
          color: "#1f2530",
          overflow: "hidden",
        }}
      >
        {template === "modern" ? (
          <ModernTemplate resume={resume} />
        ) : template === "compact" ? (
          <CompactTemplate resume={resume} />
        ) : (
          <MinimalTemplate resume={resume} />
        )}
      </div>
    </div>
  );
}

// ─── Minimal ──────────────────────────────────────────────────────────────

function MinimalTemplate({ resume: r }: { resume: ResumeInput }) {
  const contactBits = [r.email, r.phone, r.location].filter(Boolean);
  return (
    <div style={{ padding: "8% 7%", fontSize: "10.5px", lineHeight: 1.5 }}>
      <h1 style={headingStyle(22)}>{r.fullName || "Your Name"}</h1>
      {r.headline && (
        <div style={{ fontSize: "11px", color: ACCENT, fontWeight: 600, marginTop: 4 }}>
          {r.headline}
        </div>
      )}
      {contactBits.length > 0 && (
        <div style={{ fontSize: "9.5px", color: MUTED, marginTop: 6 }}>
          {contactBits.join("  ·  ")}
        </div>
      )}
      <Links links={r.links} />
      <Hr />

      {r.summary && (
        <Section title="Summary" variant="rule">
          <p style={paragraph}>{r.summary}</p>
        </Section>
      )}
      {r.experience.length > 0 && (
        <Section title="Experience" variant="rule">
          <ExperienceList items={r.experience} />
        </Section>
      )}
      {r.projects.length > 0 && (
        <Section title="Projects" variant="rule">
          <ProjectsList items={r.projects} />
        </Section>
      )}
      {r.education.length > 0 && (
        <Section title="Education" variant="rule">
          <EducationList items={r.education} />
        </Section>
      )}
      {r.skills.length > 0 && (
        <Section title="Skills" variant="rule">
          <SkillsList groups={r.skills} />
        </Section>
      )}
      {r.certifications.length > 0 && (
        <Section title="Certifications" variant="rule">
          <CertsList items={r.certifications} />
        </Section>
      )}
      {r.languages.length > 0 && (
        <Section title="Languages" variant="rule">
          <LanguagesLine items={r.languages} />
        </Section>
      )}
    </div>
  );
}

// ─── Modern ───────────────────────────────────────────────────────────────

function ModernTemplate({ resume: r }: { resume: ResumeInput }) {
  const contactBits = [r.email, r.phone, r.location].filter(Boolean);
  return (
    <div
      style={{
        padding: "7% 7% 6%",
        fontSize: "10px",
        lineHeight: 1.5,
      }}
    >
      {/* ── Editorial header — full width, no color band ────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 12,
          borderBottom: `1.5px solid ${ACCENT}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              ...headingStyle(26),
              fontWeight: 800,
              lineHeight: 1.05,
            }}
          >
            {r.fullName || "Your Name"}
          </h1>
          {r.headline && (
            <div
              style={{
                marginTop: 4,
                fontSize: "11.5px",
                color: ACCENT,
                fontWeight: 600,
                letterSpacing: "-0.005em",
              }}
            >
              {r.headline}
            </div>
          )}
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: "9px",
            color: MUTED,
            lineHeight: 1.6,
            flexShrink: 0,
          }}
        >
          {contactBits.map((c, i) => (
            <div key={i}>{c}</div>
          ))}
          {r.links
            .filter((l) => l.url)
            .slice(0, 3)
            .map((l, i) => (
              <div key={i}>
                <span style={{ color: INK, fontWeight: 600 }}>{l.label || "link"}</span>{" "}
                <span>{l.url}</span>
              </div>
            ))}
        </div>
      </header>

      {/* ── Body: two columns, narrow sidebar on the right ─────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.85fr) minmax(0, 1fr)",
          gap: "6%",
          marginTop: 16,
        }}
      >
        {/* Main: the narrative — what the recruiter actually reads */}
        <main>
          {r.summary && (
            <ModernSection title="Profile">
              <p style={paragraph}>{r.summary}</p>
            </ModernSection>
          )}
          {r.experience.length > 0 && (
            <ModernSection title="Experience">
              <ExperienceList items={r.experience} />
            </ModernSection>
          )}
          {r.projects.length > 0 && (
            <ModernSection title="Projects">
              <ProjectsList items={r.projects} />
            </ModernSection>
          )}
          {r.education.length > 0 && (
            <ModernSection title="Education">
              <EducationList items={r.education} />
            </ModernSection>
          )}
        </main>

        {/* Sidebar: scannable lists — skills / languages / certs */}
        <aside
          style={{
            fontSize: "9.5px",
            color: "#1f2530",
            paddingLeft: "5%",
            borderLeft: `1px solid ${RULE}`,
          }}
        >
          {r.skills.length > 0 && (
            <ModernSection title="Skills" tight>
              {r.skills
                .filter((g) => g.items.length > 0)
                .map((g, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: INK,
                        marginBottom: 2,
                        fontSize: "9.5px",
                      }}
                    >
                      {g.group || "Skills"}
                    </div>
                    <div style={{ color: "#3a4150" }}>{g.items.join(" · ")}</div>
                  </div>
                ))}
            </ModernSection>
          )}

          {r.certifications.length > 0 && (
            <ModernSection title="Certifications" tight>
              {r.certifications.map((c, i) => (
                <div key={i} style={{ marginBottom: 5 }}>
                  <div style={{ fontWeight: 700, color: INK }}>{c.name}</div>
                  {(c.issuer || c.year) && (
                    <div style={{ color: MUTED, fontSize: "9px" }}>
                      {[c.issuer, c.year].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </ModernSection>
          )}

          {r.languages.length > 0 && (
            <ModernSection title="Languages" tight>
              {r.languages
                .filter((l) => l.name)
                .map((l, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: INK }}>{l.name}</span>
                    {l.proficiency && (
                      <span style={{ color: MUTED, fontSize: "9px" }}>
                        {l.proficiency}
                      </span>
                    )}
                  </div>
                ))}
            </ModernSection>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Section primitive used only by the modern template — small caps
 * heading with a 12px accent square to the left, no rule beneath. The
 * `tight` variant tightens the top margin so sidebar blocks stack
 * closer together.
 */
function ModernSection({
  title,
  children,
  tight,
}: {
  title: string;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <div style={{ marginTop: tight ? 10 : 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 1,
            background: ACCENT,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "1.6px",
            color: INK,
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Compact ──────────────────────────────────────────────────────────────

function CompactTemplate({ resume: r }: { resume: ResumeInput }) {
  const contactBits = [r.email, r.phone, r.location].filter(Boolean);
  return (
    <div style={{ padding: "6% 6%", fontSize: "9.5px", lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h1 style={headingStyle(18)}>{r.fullName || "Your Name"}</h1>
        {r.headline && (
          <span style={{ color: ACCENT, fontWeight: 600, fontSize: "10.5px" }}>
            · {r.headline}
          </span>
        )}
      </div>
      {contactBits.length > 0 && (
        <div style={{ fontSize: "9px", color: MUTED, marginTop: 2 }}>
          {contactBits.join("  ·  ")}
          {r.links.filter((l) => l.url).length > 0 && "  ·  "}
          {r.links
            .filter((l) => l.url)
            .map((l, i, arr) => (
              <span key={i}>
                {l.label || "link"}: {l.url}
                {i < arr.length - 1 && "  ·  "}
              </span>
            ))}
        </div>
      )}
      <div style={{ height: 0.6, background: RULE, margin: "6px 0 4px" }} />

      {r.summary && (
        <Section title="Summary" variant="inline">
          <p style={{ ...paragraph, marginTop: 0 }}>{r.summary}</p>
        </Section>
      )}
      {r.experience.length > 0 && (
        <Section title="Experience" variant="inline">
          <ExperienceList items={r.experience} compact />
        </Section>
      )}
      {r.projects.length > 0 && (
        <Section title="Projects" variant="inline">
          <ProjectsList items={r.projects} compact />
        </Section>
      )}
      {r.education.length > 0 && (
        <Section title="Education" variant="inline">
          <EducationList items={r.education} compact />
        </Section>
      )}
      {r.skills.length > 0 && (
        <Section title="Skills" variant="inline">
          <SkillsList groups={r.skills} />
        </Section>
      )}
      {(r.certifications.length > 0 || r.languages.length > 0) && (
        <Section title="Other" variant="inline">
          {r.certifications.length > 0 && (
            <div style={{ marginBottom: 2 }}>
              <strong style={{ color: INK }}>Certifications: </strong>
              {r.certifications
                .filter((c) => c.name)
                .map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(" — "))
                .join(" · ")}
            </div>
          )}
          {r.languages.length > 0 && (
            <div>
              <strong style={{ color: INK }}>Languages: </strong>
              <LanguagesLine items={r.languages} />
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

// ─── Shared section primitives ────────────────────────────────────────────

const ACCENT = "#2563eb";
const INK = "#0e1014";
const MUTED = "#5c6573";
const RULE = "#d8dde6";

function headingStyle(size: number): React.CSSProperties {
  return {
    fontSize: `${size}px`,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: INK,
    margin: 0,
  };
}

const paragraph: React.CSSProperties = { margin: "4px 0 0 0", color: "#1f2530" };

function Section({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  /** rule = blue underline accent (minimal) · bold = no rule, bigger heading
   *  (modern) · inline = compact, heading + content in same flow. */
  variant: "rule" | "bold" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div style={{ marginTop: 8 }}>
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "1.4px",
            fontWeight: 700,
            color: ACCENT,
            textTransform: "uppercase",
            marginRight: 6,
          }}
        >
          {title}
        </span>
        {children}
      </div>
    );
  }
  if (variant === "bold") {
    return (
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 800,
            color: INK,
            textTransform: "uppercase",
            letterSpacing: "1.2px",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div>{children}</div>
      </div>
    );
  }
  // default: rule
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: "9.5px",
          letterSpacing: "1.6px",
          fontWeight: 700,
          color: INK,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ width: 36, height: 1.4, background: ACCENT, margin: "4px 0 6px" }} />
      <div>{children}</div>
    </div>
  );
}

function Hr() {
  return <div style={{ height: 0.6, background: RULE, margin: "10px 0 4px" }} />;
}

function Links({ links }: { links: ResumeInput["links"] }) {
  const real = links.filter((l) => l.url);
  if (real.length === 0) return null;
  return (
    <div style={{ fontSize: "9.5px", color: MUTED, marginTop: 2 }}>
      {real.map((l, i) => (
        <span key={i}>
          {i > 0 ? "  ·  " : ""}
          {l.label || "link"}: {l.url}
        </span>
      ))}
    </div>
  );
}

function TwoCol({ left, right }: { left: string; right: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
      }}
    >
      <div style={{ fontWeight: 700, color: INK }}>{left}</div>
      {right && <div style={{ color: MUTED, fontSize: "9.5px" }}>{right}</div>}
    </div>
  );
}

function ExperienceList({
  items,
  compact,
}: {
  items: ResumeInput["experience"];
  compact?: boolean;
}) {
  return (
    <>
      {items.map((e, i) => (
        <div key={i} style={{ marginBottom: compact ? 6 : 12 }}>
          <TwoCol
            left={`${e.role || ""}${e.company ? ` · ${e.company}` : ""}`}
            right={formatRange(e.startDate, e.endDate, e.current)}
          />
          {!compact && e.location && (
            <div style={{ fontStyle: "italic", color: MUTED, fontSize: "9.5px" }}>
              {e.location}
            </div>
          )}
          {e.bullets.filter(Boolean).length > 0 && (
            <ul style={{ marginTop: compact ? 2 : 4, paddingLeft: 16 }}>
              {e.bullets
                .filter(Boolean)
                .map((b, j) => (
                  <li key={j} style={{ marginBottom: compact ? 1 : 2 }}>
                    {b}
                  </li>
                ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}

function ProjectsList({
  items,
  compact,
}: {
  items: ResumeInput["projects"];
  compact?: boolean;
}) {
  return (
    <>
      {items.map((p, i) => (
        <div key={i} style={{ marginBottom: compact ? 6 : 10 }}>
          <TwoCol
            left={`${p.name || ""}${p.role ? ` · ${p.role}` : ""}`}
            right={p.year}
          />
          {p.body && <p style={paragraph}>{p.body}</p>}
          {p.links.length > 0 && (
            <div style={{ fontSize: "9px", color: MUTED }}>
              {p.links
                .filter((l) => l.url)
                .map((l, j) => (
                  <span key={j}>
                    {j > 0 ? "  ·  " : ""}
                    {l.label || "link"}: {l.url}
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function EducationList({
  items,
  compact,
}: {
  items: ResumeInput["education"];
  compact?: boolean;
}) {
  return (
    <>
      {items.map((e, i) => {
        const left = [e.degree, e.field].filter(Boolean).join(" — ");
        return (
          <div key={i} style={{ marginBottom: compact ? 4 : 10 }}>
            <TwoCol
              left={left || e.institution}
              right={formatRange(e.startDate, e.endDate, e.current)}
            />
            {left && e.institution && (
              <div style={{ color: MUTED, fontSize: "9.5px" }}>{e.institution}</div>
            )}
            {!compact && e.notes && <p style={paragraph}>{e.notes}</p>}
          </div>
        );
      })}
    </>
  );
}

function SkillsList({ groups }: { groups: ResumeInput["skills"] }) {
  return (
    <>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: INK }}>{g.group || "Skills"}:</span>{" "}
            {g.items.join(" · ")}
          </div>
        ))}
    </>
  );
}

function CertsList({ items }: { items: ResumeInput["certifications"] }) {
  return (
    <>
      {items.map((c, i) => (
        <TwoCol
          key={i}
          left={`${c.name || ""}${c.issuer ? ` · ${c.issuer}` : ""}`}
          right={c.year}
        />
      ))}
    </>
  );
}

function LanguagesLine({ items }: { items: ResumeInput["languages"] }) {
  return (
    <>
      {items
        .filter((l) => l.name)
        .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name))
        .join("  ·  ")}
    </>
  );
}

function formatRange(start: string, end: string, current: boolean) {
  const a = start || "";
  const b = current ? "Present" : end || "";
  if (a && b) return `${a} – ${b}`;
  return a || b;
}
