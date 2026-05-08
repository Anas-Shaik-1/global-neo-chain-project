import { useMemo, useState } from "react";
import {
  Bug as BugIcon,
  Eye,
  ImageOff,
  Pencil,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BUG_STATUSES, useBugs, type Bug, type BugStatus } from "../api/hooks";
import { ReportBugDialog } from "../components/ReportBugDialog";
import { BugDetailDialog } from "../components/BugDetailDialog";

// ---------------------------------------------------------------------------
// Filter chip set
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | BugStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "FIXED", label: "Fixed" },
  { value: "WONT_FIX", label: "Won't fix" },
];

const STATUS_TONES: Record<BugStatus, "warn" | "info" | "success" | "default"> = {
  OPEN: "warn",
  IN_PROGRESS: "info",
  FIXED: "success",
  WONT_FIX: "default",
};

const STATUS_LABELS: Record<BugStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  FIXED: "Fixed",
  WONT_FIX: "Won't fix",
};

// ---------------------------------------------------------------------------
// KPI Tile (shared shape with Expenses/Calls/People/Payroll)
// ---------------------------------------------------------------------------

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success" | "danger" | "warn";
}

const TONE_STYLES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "border-border/60",
  primary: "border-primary/40",
  success: "border-emerald-500/30",
  warn: "border-amber-500/30",
  danger: "border-red-500/30",
};

const TONE_ICON: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-red-400",
};

function KpiTile({ label, value, hint, icon, tone = "default" }: KpiTileProps) {
  return (
    <div className={cn("rounded-xl border bg-card/40 p-4", TONE_STYLES[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {value}
          </div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40",
            TONE_ICON[tone],
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function FilterPills({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter bugs by status"
      className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-card/40 p-1"
    >
      {FILTERS.map((opt) => {
        const active = opt.value === value;
        const count = counts[opt.value] ?? 0;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                active ? "bg-black/15" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function BugsPage() {
  const me = useAppSelector((s) => s.auth.user);
  // Bugs are now open for any authenticated user to file (matching the
  // backend permission model). The "isTester" boolean is kept as a soft
  // signal for the QA-flavoured copy but no longer gates the report button.
  const isTester = me?.role === "TESTER";
  const isAdmin = me?.role === "ADMIN";
  const canReport = !!me;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [showReport, setShowReport] = useState(false);
  const [openBug, setOpenBug] = useState<Bug | null>(null);

  const { data, isLoading } = useBugs({ limit: 200 });
  const allBugs = data?.items ?? [];

  const stats = useMemo(() => {
    const counts: Record<BugStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      FIXED: 0,
      WONT_FIX: 0,
    };
    for (const b of allBugs) counts[b.status] += 1;
    return { total: allBugs.length, ...counts };
  }, [allBugs]);

  const counts: Record<StatusFilter, number> = {
    ALL: stats.total,
    OPEN: stats.OPEN,
    IN_PROGRESS: stats.IN_PROGRESS,
    FIXED: stats.FIXED,
    WONT_FIX: stats.WONT_FIX,
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return allBugs.filter((b) => {
      if (filter !== "ALL" && b.status !== filter) return false;
      if (t) {
        return (
          b.title.toLowerCase().includes(t) ||
          b.code.toLowerCase().includes(t) ||
          (b.createdByName ?? "").toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [allBugs, filter, search]);

  const paginated = usePagination(filtered, 10);

  const canEdit = (b: Bug): boolean =>
    !!me && (me.id === b.createdById || isAdmin);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Quality · Bug tracker"
        title="Bugs"
        description={
          isTester
            ? "File and triage bugs for the engineering team. Auto-generated branch codes keep work-tree names consistent."
            : "File a bug, browse the team's known issues, and follow status changes. Anyone can report; only the reporter or an Admin can edit."
        }
        actions={
          canReport ? (
            <Button onClick={() => setShowReport(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Report bug
            </Button>
          ) : null
        }
      />

      {/* KPI strip */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : allBugs.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Total bugs"
            value={String(stats.total)}
            hint="Filed across the project"
            icon={<BugIcon className="h-4 w-4" />}
            tone="primary"
          />
          <KpiTile
            label="Open"
            value={String(stats.OPEN)}
            hint={stats.OPEN === 0 ? "All clear" : "Need attention"}
            icon={<BugIcon className="h-4 w-4" />}
            tone={stats.OPEN > 0 ? "warn" : "default"}
          />
          <KpiTile
            label="In progress"
            value={String(stats.IN_PROGRESS)}
            hint="Being worked on"
            icon={<BugIcon className="h-4 w-4" />}
            tone="default"
          />
          <KpiTile
            label="Fixed"
            value={String(stats.FIXED)}
            hint={`${stats.WONT_FIX} won't fix`}
            icon={<BugIcon className="h-4 w-4" />}
            tone="success"
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="lg:max-w-md lg:flex-1">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by title, code, or reporter…"
                ariaLabel="Search bugs"
              />
            </div>
            {allBugs.length > 0 && (
              <FilterPills value={filter} onChange={setFilter} counts={counts} />
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : allBugs.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <BugIcon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                No bugs filed yet
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Click Report bug above to file the first one.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
              No bugs match this filter.
            </div>
          ) : (
            <>
              {/* Mobile: card stack */}
              <div className="space-y-3 md:hidden">
                {paginated.items.map((b) => (
                  <div
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenBug(b)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenBug(b);
                      }
                    }}
                    className="cursor-pointer rounded-lg border border-border/60 bg-card/40 p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400">
                        <BugIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {b.title}
                          </span>
                          <StatusBadge tone={STATUS_TONES[b.status]}>
                            {STATUS_LABELS[b.status]}
                          </StatusBadge>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {b.code}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {b.description}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                      <span className="truncate">
                        {b.createdByName ?? "Unknown"} ·{" "}
                        {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenBug(b);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {canEdit(b) ? "Open" : "View"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-2">Title</TableHead>
                      <TableHead className="px-2">Code</TableHead>
                      <TableHead className="px-2">Status</TableHead>
                      <TableHead className="px-2">Image</TableHead>
                      <TableHead className="px-2">Reporter</TableHead>
                      <TableHead className="px-2 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.items.map((b) => (
                      <TableRow
                        key={b.id}
                        onClick={() => setOpenBug(b)}
                        className="cursor-pointer hover:bg-accent/30"
                      >
                        <TableCell className="px-2 py-3 max-w-[28ch] truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{b.title}</span>
                            {b.projectKey && (
                              <span
                                className="inline-flex items-center rounded-md border border-border/60 bg-card/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                                title={b.projectName ?? b.projectKey}
                              >
                                {b.projectKey}
                              </span>
                            )}
                          </div>
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {b.description}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-3 font-mono text-xs text-muted-foreground">
                          {b.code}
                        </TableCell>
                        <TableCell className="px-2 py-3">
                          <StatusBadge tone={STATUS_TONES[b.status]}>
                            {STATUS_LABELS[b.status]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="px-2 py-3">
                          {b.imageUrl ? (
                            <a
                              href={b.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2.5 text-xs font-medium text-foreground/85 outline-none transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                              title="Open screenshot in a new tab"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View image
                            </a>
                          ) : (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2.5 text-xs text-muted-foreground/60">
                              <ImageOff className="h-3.5 w-3.5" />
                              No image
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-xs text-muted-foreground">
                          <div>{b.createdByName ?? "Unknown"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/70">
                            {new Date(b.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            onClick={(e) => {
                              // The whole row already opens the dialog; the
                              // explicit button is kept for affordance/keyboard
                              // users. Stop propagation so we don't toggle.
                              e.stopPropagation();
                              setOpenBug(b);
                            }}
                          >
                            {canEdit(b) ? (
                              <>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={paginated.page}
                pageSize={paginated.pageSize}
                totalPages={paginated.totalPages}
                totalItems={paginated.totalItems}
                onPageChange={paginated.setPage}
                onPageSizeChange={paginated.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ReportBugDialog open={showReport} onOpenChange={setShowReport} />
      <BugDetailDialog
        bug={openBug}
        open={!!openBug}
        onOpenChange={(o) => {
          if (!o) setOpenBug(null);
        }}
      />
    </PageContainer>
  );
}

// Re-exports the BugStatus enum value for convenience in other files.
export { BUG_STATUSES };
