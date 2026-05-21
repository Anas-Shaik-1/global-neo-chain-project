import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Download,
  FileText,
  FileUp,
  GraduationCap,
  Languages,
  Link as LinkIcon,
  ListChecks,
  Save,
  Sparkles,
  Tags,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageContainer } from "@/components/common/PageContainer";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppSelector } from "@/app/hooks";
import {
  downloadResumePdf,
  EMPTY_CERT,
  EMPTY_EDUCATION,
  EMPTY_EXPERIENCE,
  EMPTY_LANG,
  EMPTY_LINK,
  EMPTY_PROJECT,
  EMPTY_SKILL_GROUP,
  RESUME_TEMPLATES,
  useMyResume,
  useSaveResume,
  type Resume,
  type ResumeInput,
  type ResumeTemplate,
} from "../api/hooks";
import { ResumePreview } from "../components/ResumePreview";
import { ImportResumeDialog } from "../components/ImportResumeDialog";

function toInput(r: Resume): ResumeInput {
  // Drop server-only fields. Default arrays for safety in case the API
  // ever returns nulls for legacy docs.
  return {
    fullName: r.fullName,
    headline: r.headline,
    email: r.email,
    phone: r.phone,
    location: r.location,
    links: r.links ?? [],
    summary: r.summary,
    experience: r.experience ?? [],
    education: r.education ?? [],
    skills: r.skills ?? [],
    projects: r.projects ?? [],
    certifications: r.certifications ?? [],
    languages: r.languages ?? [],
    template: r.template,
  };
}

export function ResumeBuilderPage() {
  const me = useAppSelector((s) => s.auth.user);
  const q = useMyResume();
  const save = useSaveResume();
  const [input, setInput] = useState<ResumeInput | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Tracks whether the form is dirty vs the last successful save so the
  // CTA can change its label and skip no-op writes.
  const lastSavedRef = useRef<string>("");

  // Hydrate the local form once the API resolves. We keep the form in a
  // local `input` object so every keystroke updates the live preview
  // without thrashing the server. Save flushes back to the API.
  useEffect(() => {
    if (q.data && !input) {
      const next = toInput(q.data);
      setInput(next);
      lastSavedRef.current = JSON.stringify(next);
    }
  }, [q.data, input]);

  function update<K extends keyof ResumeInput>(key: K, value: ResumeInput[K]) {
    setInput((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function onSave() {
    if (!input) return;
    const serialised = JSON.stringify(input);
    if (serialised === lastSavedRef.current) return;
    save.mutate(input, {
      onSuccess: () => {
        lastSavedRef.current = serialised;
      },
    });
  }

  async function onDownload() {
    if (!input) return;
    // Save first so the PDF reflects the latest in-memory edits.
    if (JSON.stringify(input) !== lastSavedRef.current) {
      await save.mutateAsync(input);
      lastSavedRef.current = JSON.stringify(input);
    }
    const slug = (input.fullName || me?.name || "resume")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
    await downloadResumePdf(`${slug || "resume"}.pdf`);
  }

  if (q.isLoading || !input) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          eyebrow="Career · Resume builder"
          title="Resume builder"
          description="Edit on the left, preview on the right, download a PDF."
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </PageContainer>
    );
  }

  const isDirty = JSON.stringify(input) !== lastSavedRef.current;

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        eyebrow="Career · Resume builder"
        title="Resume builder"
        description="Edit on the left, preview on the right, download a PDF — modeled on resume.globalneochain.com."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setImportOpen(true)}
              title="Paste an existing resume to pre-populate the form"
            >
              <FileUp className="h-4 w-4" />
              Import existing
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onSave}
              disabled={save.isPending || !isDirty}
            >
              <Save className="h-4 w-4" />
              {save.isPending ? "Saving…" : isDirty ? "Save" : "Saved"}
            </Button>
            <Button size="sm" className="gap-2" onClick={onDownload}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        }
      />

      <ImportResumeDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        current={input}
        onApply={(next) => setInput(next)}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* ── Editor ─────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="flex flex-wrap gap-1">
                <TabsTrigger value="profile" className="gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" /> Profile
                </TabsTrigger>
                <TabsTrigger value="experience" className="gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Experience
                </TabsTrigger>
                <TabsTrigger value="education" className="gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> Education
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-1.5">
                  <Tags className="h-3.5 w-3.5" /> Skills
                </TabsTrigger>
                <TabsTrigger value="projects" className="gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" /> Projects
                </TabsTrigger>
                <TabsTrigger value="extras" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Extras
                </TabsTrigger>
              </TabsList>

              {/* Profile */}
              <TabsContent value="profile" className="space-y-4">
                <Field
                  label="Full name"
                  value={input.fullName}
                  onChange={(v) => update("fullName", v)}
                  placeholder="Ruhina Begum Shaik"
                />
                <Field
                  label="Headline"
                  value={input.headline}
                  onChange={(v) => update("headline", v)}
                  placeholder="Senior Software Engineer · React + Node"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Email"
                    value={input.email}
                    onChange={(v) => update("email", v)}
                    placeholder="you@example.com"
                  />
                  <Field
                    label="Phone"
                    value={input.phone}
                    onChange={(v) => update("phone", v)}
                    placeholder="+91 80000 00000"
                  />
                </div>
                <Field
                  label="Location"
                  value={input.location}
                  onChange={(v) => update("location", v)}
                  placeholder="Nellore, India"
                />
                <Repeater
                  title="Links"
                  icon={<LinkIcon className="h-3.5 w-3.5" />}
                  items={input.links}
                  onChange={(next) => update("links", next)}
                  empty={EMPTY_LINK}
                  render={(link, set) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="GitHub"
                        value={link.label}
                        onChange={(e) => set({ ...link, label: e.target.value })}
                      />
                      <Input
                        placeholder="https://github.com/you"
                        value={link.url}
                        onChange={(e) => set({ ...link, url: e.target.value })}
                      />
                    </div>
                  )}
                />
                <FieldTextarea
                  label="Summary"
                  value={input.summary}
                  onChange={(v) => update("summary", v)}
                  placeholder="Two or three sentences. What you build, what you care about, what you've shipped lately."
                  rows={5}
                />
                <div>
                  <Label className="mb-2 block text-xs text-muted-foreground">
                    Template
                  </Label>
                  <div className="flex flex-wrap gap-1 rounded-md border border-border/60 bg-card/40 p-1">
                    {RESUME_TEMPLATES.map((t) => {
                      const active = input.template === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update("template", t as ResumeTemplate)}
                          className={`inline-flex h-8 items-center rounded px-3 text-xs font-medium capitalize transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Switches both the live preview and the downloaded PDF.
                  </p>
                </div>
              </TabsContent>

              {/* Experience */}
              <TabsContent value="experience">
                <Repeater
                  title="Experience"
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  items={input.experience}
                  onChange={(next) => update("experience", next)}
                  empty={EMPTY_EXPERIENCE}
                  render={(exp, set) => (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Company"
                          value={exp.company}
                          onChange={(e) => set({ ...exp, company: e.target.value })}
                        />
                        <Input
                          placeholder="Role"
                          value={exp.role}
                          onChange={(e) => set({ ...exp, role: e.target.value })}
                        />
                      </div>
                      <Input
                        placeholder="Location (optional)"
                        value={exp.location}
                        onChange={(e) => set({ ...exp, location: e.target.value })}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Start (e.g. 2023-01)"
                          value={exp.startDate}
                          onChange={(e) => set({ ...exp, startDate: e.target.value })}
                        />
                        <Input
                          placeholder="End"
                          value={exp.endDate}
                          onChange={(e) => set({ ...exp, endDate: e.target.value })}
                          disabled={exp.current}
                        />
                        <label className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={exp.current}
                            onChange={(e) =>
                              set({ ...exp, current: e.target.checked, endDate: e.target.checked ? "" : exp.endDate })
                            }
                          />
                          Current role
                        </label>
                      </div>
                      <BulletList
                        bullets={exp.bullets}
                        onChange={(next) => set({ ...exp, bullets: next })}
                      />
                    </div>
                  )}
                />
              </TabsContent>

              {/* Education */}
              <TabsContent value="education">
                <Repeater
                  title="Education"
                  icon={<GraduationCap className="h-3.5 w-3.5" />}
                  items={input.education}
                  onChange={(next) => update("education", next)}
                  empty={EMPTY_EDUCATION}
                  render={(ed, set) => (
                    <div className="space-y-3">
                      <Input
                        placeholder="Institution"
                        value={ed.institution}
                        onChange={(e) => set({ ...ed, institution: e.target.value })}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Degree (e.g. B.Tech)"
                          value={ed.degree}
                          onChange={(e) => set({ ...ed, degree: e.target.value })}
                        />
                        <Input
                          placeholder="Field (e.g. Computer Science)"
                          value={ed.field}
                          onChange={(e) => set({ ...ed, field: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Start"
                          value={ed.startDate}
                          onChange={(e) => set({ ...ed, startDate: e.target.value })}
                        />
                        <Input
                          placeholder="End"
                          value={ed.endDate}
                          onChange={(e) => set({ ...ed, endDate: e.target.value })}
                          disabled={ed.current}
                        />
                        <label className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={ed.current}
                            onChange={(e) =>
                              set({ ...ed, current: e.target.checked, endDate: e.target.checked ? "" : ed.endDate })
                            }
                          />
                          In progress
                        </label>
                      </div>
                      <Textarea
                        placeholder="Notes (optional)"
                        value={ed.notes}
                        rows={2}
                        onChange={(e) => set({ ...ed, notes: e.target.value })}
                      />
                    </div>
                  )}
                />
              </TabsContent>

              {/* Skills */}
              <TabsContent value="skills">
                <Repeater
                  title="Skill groups"
                  icon={<Tags className="h-3.5 w-3.5" />}
                  items={input.skills}
                  onChange={(next) => update("skills", next)}
                  empty={EMPTY_SKILL_GROUP}
                  render={(g, set) => (
                    <div className="space-y-3">
                      <Input
                        placeholder="Group name (Languages / Tools / Cloud / …)"
                        value={g.group}
                        onChange={(e) => set({ ...g, group: e.target.value })}
                      />
                      <CommaList
                        value={g.items}
                        onChange={(next) => set({ ...g, items: next })}
                        placeholder="Comma-separated. e.g. TypeScript, React, Node"
                      />
                    </div>
                  )}
                />
              </TabsContent>

              {/* Projects */}
              <TabsContent value="projects">
                <Repeater
                  title="Projects"
                  icon={<ListChecks className="h-3.5 w-3.5" />}
                  items={input.projects}
                  onChange={(next) => update("projects", next)}
                  empty={EMPTY_PROJECT}
                  render={(p, set) => (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_120px]">
                        <Input
                          placeholder="Project name"
                          value={p.name}
                          onChange={(e) => set({ ...p, name: e.target.value })}
                        />
                        <Input
                          placeholder="Your role"
                          value={p.role}
                          onChange={(e) => set({ ...p, role: e.target.value })}
                        />
                        <Input
                          placeholder="Year"
                          value={p.year}
                          onChange={(e) => set({ ...p, year: e.target.value })}
                        />
                      </div>
                      <Textarea
                        placeholder="What it was, what you did, what shipped."
                        value={p.body}
                        rows={3}
                        onChange={(e) => set({ ...p, body: e.target.value })}
                      />
                      <Repeater
                        title="Links"
                        compact
                        icon={<LinkIcon className="h-3 w-3" />}
                        items={p.links}
                        onChange={(next) => set({ ...p, links: next })}
                        empty={EMPTY_LINK}
                        render={(link, setL) => (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              placeholder="Label"
                              value={link.label}
                              onChange={(e) => setL({ ...link, label: e.target.value })}
                            />
                            <Input
                              placeholder="https://…"
                              value={link.url}
                              onChange={(e) => setL({ ...link, url: e.target.value })}
                            />
                          </div>
                        )}
                      />
                    </div>
                  )}
                />
              </TabsContent>

              {/* Extras: certs + languages */}
              <TabsContent value="extras" className="space-y-6">
                <Repeater
                  title="Certifications"
                  icon={<FileText className="h-3.5 w-3.5" />}
                  items={input.certifications}
                  onChange={(next) => update("certifications", next)}
                  empty={EMPTY_CERT}
                  render={(c, set) => (
                    <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_120px]">
                      <Input
                        placeholder="Certification name"
                        value={c.name}
                        onChange={(e) => set({ ...c, name: e.target.value })}
                      />
                      <Input
                        placeholder="Issuer"
                        value={c.issuer}
                        onChange={(e) => set({ ...c, issuer: e.target.value })}
                      />
                      <Input
                        placeholder="Year"
                        value={c.year}
                        onChange={(e) => set({ ...c, year: e.target.value })}
                      />
                    </div>
                  )}
                />

                <Repeater
                  title="Languages"
                  icon={<Languages className="h-3.5 w-3.5" />}
                  items={input.languages}
                  onChange={(next) => update("languages", next)}
                  empty={EMPTY_LANG}
                  render={(l, set) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Language"
                        value={l.name}
                        onChange={(e) => set({ ...l, name: e.target.value })}
                      />
                      <Input
                        placeholder="Proficiency (Native / Fluent / Conversational)"
                        value={l.proficiency}
                        onChange={(e) => set({ ...l, proficiency: e.target.value })}
                      />
                    </div>
                  )}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Live preview ───────────────────────────────────────────── */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <ResumePreview resume={input} />
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Live preview · final PDF mirrors this layout
          </p>
        </div>
      </div>
    </PageContainer>
  );
}

// ─── Tiny helper components ───────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

interface RepeaterProps<T> {
  title: string;
  icon?: React.ReactNode;
  items: T[];
  onChange: (next: T[]) => void;
  empty: T;
  render: (item: T, set: (next: T) => void, index: number) => React.ReactNode;
  compact?: boolean;
}

function Repeater<T>({
  title,
  icon,
  items,
  onChange,
  empty,
  render,
  compact,
}: RepeaterProps<T>) {
  function add() {
    onChange([...items, structuredClone(empty)]);
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  function set(i: number, next: T) {
    onChange(items.map((it, j) => (j === i ? next : it)));
  }
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {icon}
          {title}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Add
        </Button>
      </div>
      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-border/60 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
          Nothing here yet — click <span className="text-foreground">+ Add</span>{" "}
          to start.
        </p>
      )}
      {items.map((it, i) => (
        <div
          key={i}
          className={
            compact
              ? "rounded-md border border-border/40 bg-card/30 p-3"
              : "rounded-md border border-border/60 bg-card/40 p-3 sm:p-4"
          }
        >
          {render(it, (next) => set(i, next), i)}
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(i)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BulletList({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  function set(i: number, value: string) {
    onChange(bullets.map((b, j) => (j === i ? value : b)));
  }
  function remove(i: number) {
    onChange(bullets.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Bullets</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...bullets, ""])}
        >
          + Bullet
        </Button>
      </div>
      {bullets.map((b, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea
            value={b}
            rows={2}
            onChange={(e) => set(i, e.target.value)}
            placeholder="One concrete outcome — what changed because you shipped."
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function CommaList({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  // Simple comma-separated input. We split on save to keep the UI as a
  // single text field (less ceremony than chip-style inputs for short
  // skill lists).
  const [draft, setDraft] = useState(value.join(", "));
  // Re-sync if the parent value changes from outside (e.g. add/remove
  // group above us).
  useEffect(() => {
    setDraft(value.join(", "));
  }, [value]);
  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}
