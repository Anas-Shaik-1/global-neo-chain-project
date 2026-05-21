import { useEffect, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useImportResumePdf, type ResumeInput } from "../api/hooks";

/**
 * Import-existing-resume dialog.
 *
 * The user uploads a PDF of their existing resume; the backend extracts
 * text via pdfjs and runs a heuristic parser, returning the same shape
 * the editor already uses. The dialog surfaces a brief "Parsed" preview
 * so the user knows what's about to land in their form.
 *
 * Two apply modes:
 *   - **Replace**: every section in the form is overwritten with the
 *     parsed result.
 *   - **Merge**: only fields the form currently has empty are filled in;
 *     non-empty arrays/strings on the form are preserved.
 */
export function ImportResumeDialog({
  open,
  onOpenChange,
  current,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The form state in the editor — used for the merge path. */
  current: ResumeInput;
  /** Called with the final resume input the editor should adopt. */
  onApply: (next: ResumeInput) => void;
}) {
  const [parsed, setParsed] = useState<ResumeInput | null>(null);
  const [parsedFromPdfName, setParsedFromPdfName] = useState<string | null>(null);
  const importPdfMutation = useImportResumePdf();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset every time the dialog opens so a previous parse doesn't bleed
  // into a fresh import.
  useEffect(() => {
    if (open) {
      setParsed(null);
      setParsedFromPdfName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function onPdfChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const next = await importPdfMutation.mutateAsync(file);
    setParsed(next);
    setParsedFromPdfName(file.name);
  }

  function applyReplace() {
    if (!parsed) return;
    onApply(parsed);
    onOpenChange(false);
  }

  function applyMerge() {
    if (!parsed) return;
    onApply(mergeResume(current, parsed));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Import existing resume
          </DialogTitle>
          <DialogDescription>
            Upload an existing PDF resume — we'll extract the text and parse
            it into the editor. You can review and adjust before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Upload PDF row ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-card/40 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/40 text-primary">
              <Upload className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                Upload an existing PDF resume
              </div>
              <div className="text-xs text-muted-foreground">
                Up to 5 MB. Bytes are read in memory and discarded — nothing
                is stored. Image-only / scanned PDFs won't extract text.
              </div>
              {parsedFromPdfName && (
                <div className="mt-1 truncate text-xs text-emerald-400">
                  Read · {parsedFromPdfName}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onPdfChosen}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importPdfMutation.isPending}
              className="gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              {importPdfMutation.isPending ? "Reading…" : "Choose PDF"}
            </Button>
          </div>

          {parsed && (
            <div className="rounded-md border border-border/60 bg-card/40 p-4 text-xs">
              <div className="mb-2 font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Parsed
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                <Field label="Name" value={parsed.fullName} />
                <Field label="Headline" value={parsed.headline} />
                <Field label="Email" value={parsed.email} />
                <Field label="Phone" value={parsed.phone} />
                <Field label="Location" value={parsed.location} />
                <Field label="Links" value={`${parsed.links.length}`} />
                <Field label="Experience" value={`${parsed.experience.length} entries`} />
                <Field label="Education" value={`${parsed.education.length} entries`} />
                <Field label="Skills" value={`${parsed.skills.length} groups`} />
                <Field label="Projects" value={`${parsed.projects.length} entries`} />
                <Field label="Certifications" value={`${parsed.certifications.length} entries`} />
                <Field label="Languages" value={`${parsed.languages.length} entries`} />
              </ul>
              {parsed.summary && (
                <div className="mt-3 line-clamp-3 text-muted-foreground">
                  <span className="font-semibold text-foreground">Summary:</span>{" "}
                  {parsed.summary}
                </div>
              )}
              <p className="mt-3 text-[10px] text-muted-foreground">
                The parser is best-effort — review and edit the form after
                importing. Anything it couldn't infer comes through blank.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={applyMerge}
            disabled={!parsed}
            title="Only fill in fields you've left empty in the form"
          >
            Merge into form
          </Button>
          <Button onClick={applyReplace} disabled={!parsed}>
            Replace form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-foreground" title={value}>
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    </li>
  );
}

/**
 * Merge a parsed resume into the user's current form, preserving any
 * non-empty values they've already typed. Strings: keep current if
 * non-empty. Arrays: keep current if non-empty.
 */
function mergeResume(current: ResumeInput, parsed: ResumeInput): ResumeInput {
  return {
    fullName: current.fullName || parsed.fullName,
    headline: current.headline || parsed.headline,
    email: current.email || parsed.email,
    phone: current.phone || parsed.phone,
    location: current.location || parsed.location,
    links: current.links.length ? current.links : parsed.links,
    summary: current.summary || parsed.summary,
    experience: current.experience.length ? current.experience : parsed.experience,
    education: current.education.length ? current.education : parsed.education,
    skills: current.skills.length ? current.skills : parsed.skills,
    projects: current.projects.length ? current.projects : parsed.projects,
    certifications: current.certifications.length
      ? current.certifications
      : parsed.certifications,
    languages: current.languages.length ? current.languages : parsed.languages,
    template: current.template,
  };
}
