import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  useCreateExpense,
  type Currency,
  type ExpenseCategory,
} from "../api/hooks";
import { parseCSV } from "@/lib/csv";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  /** 1-based row number in the source CSV (header at line 1, first data row = 2). */
  line: number;
  raw: string[];
  parsed?: {
    incurredOn: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    currency: Currency;
  };
  error?: string;
}

const REQUIRED_HEADERS = ["date", "category", "description", "amount"] as const;

/**
 * Look up a header value in the row by header name (case-insensitive,
 * trimmed). Returns empty string when missing.
 */
function lookup(headers: string[], row: string[], key: string): string {
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === key);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

function validateRow(
  headers: string[],
  row: string[],
  line: number,
): ParsedRow {
  const date = lookup(headers, row, "date");
  const category = lookup(headers, row, "category").toUpperCase();
  const description = lookup(headers, row, "description");
  const amountStr = lookup(headers, row, "amount");
  const currencyStr = (lookup(headers, row, "currency") || "INR").toUpperCase();

  if (!date) return { line, raw: row, error: "missing date" };
  if (Number.isNaN(new Date(date).getTime())) {
    return { line, raw: row, error: `invalid date: ${date}` };
  }
  if (!category) return { line, raw: row, error: "missing category" };
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return {
      line,
      raw: row,
      error: `category must be one of ${EXPENSE_CATEGORIES.join(", ")}`,
    };
  }
  if (!description) return { line, raw: row, error: "missing description" };
  if (!amountStr) return { line, raw: row, error: "missing amount" };
  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount < 0) {
    return { line, raw: row, error: `invalid amount: ${amountStr}` };
  }
  if (!(CURRENCIES as readonly string[]).includes(currencyStr)) {
    return {
      line,
      raw: row,
      error: `currency must be ${CURRENCIES.join(" or ")}`,
    };
  }

  return {
    line,
    raw: row,
    parsed: {
      incurredOn: new Date(date).toISOString(),
      category: category as ExpenseCategory,
      description,
      // Convert major units (₹1,500.00) to paise (150000) — matches what
      // the backend stores. Round to int so floats don't sneak in.
      amount: Math.round(amount * 100),
      currency: currencyStr as Currency,
    },
  };
}

export function ImportExpensesDialog({ open, onOpenChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreateExpense();
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0 });

  const validRows = useMemo(() => rows.filter((r) => r.parsed), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.error), [rows]);

  function reset() {
    setFilename(null);
    setRows([]);
    setHeaderError(null);
    setProgress({ done: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickFile(file: File) {
    reset();
    setFilename(file.name);
    const text = await file.text();
    const all = parseCSV(text);
    if (all.length === 0) {
      setHeaderError("File is empty.");
      return;
    }
    const headers = all[0]!.map((h) => h.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      setHeaderError(
        `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
      );
      return;
    }
    const dataRows = all.slice(1);
    const parsed = dataRows.map((row, i) => validateRow(headers, row, i + 2));
    setRows(parsed);
  }

  async function runImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    let done = 0;
    let failed = 0;
    // Sequential to keep server load low and surface errors row-by-row. For
    // bulk-imports of >100 rows a backend bulk-create endpoint would be
    // worth adding.
    for (const r of validRows) {
      if (!r.parsed) continue;
      try {
        await create.mutateAsync(r.parsed);
        done += 1;
      } catch {
        failed += 1;
      }
      setProgress({ done, failed });
    }
    setImporting(false);
    toast.success(
      `Imported ${done} of ${validRows.length}${failed > 0 ? ` (${failed} failed)` : ""}.`,
    );
    if (failed === 0) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !importing) {
          reset();
          onOpenChange(false);
        } else if (o) {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import expenses from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a comma-separated file with the columns:{" "}
            <code className="font-mono text-[11px]">
              date, category, description, amount, currency
            </code>
            . Amount is in major units (e.g. <code>1500.00</code>) and currency
            defaults to <code>INR</code>.
          </DialogDescription>
        </DialogHeader>

        {!filename ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-card/60">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">Choose a CSV file</div>
            <div className="max-w-sm text-xs text-muted-foreground">
              Excel can save any sheet as CSV via <em>File → Save As → CSV (Comma delimited)</em>.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{filename}</div>
                <div className="text-xs text-muted-foreground">
                  {rows.length} data {rows.length === 1 ? "row" : "rows"} parsed
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={reset}
                disabled={importing}
              >
                Choose another
              </Button>
            </div>

            {headerError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{headerError}</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-500/30 bg-card/40 p-3">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    Ready to import
                  </div>
                  <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                    {validRows.length}
                  </div>
                </div>
                <div
                  className={`rounded-lg border p-3 ${
                    invalidRows.length > 0
                      ? "border-amber-500/30"
                      : "border-border/60"
                  }`}
                >
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                    Skipped (errors)
                  </div>
                  <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                    {invalidRows.length}
                  </div>
                </div>
              </div>
            )}

            {invalidRows.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border border-border/60 bg-card/30 p-2 text-xs">
                <div className="mb-1 font-semibold text-muted-foreground">
                  Invalid rows (will be skipped):
                </div>
                <ul className="space-y-1">
                  {invalidRows.slice(0, 10).map((r) => (
                    <li key={r.line} className="text-muted-foreground">
                      <span className="font-mono">line {r.line}:</span>{" "}
                      <span className="text-destructive">{r.error}</span>
                    </li>
                  ))}
                  {invalidRows.length > 10 && (
                    <li className="italic text-muted-foreground">
                      …and {invalidRows.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {importing && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Importing… {progress.done} done · {progress.failed} failed
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={runImport}
            disabled={importing || validRows.length === 0 || !!headerError}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {importing
              ? "Importing…"
              : validRows.length === 0
                ? "Nothing to import"
                : `Import ${validRows.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
