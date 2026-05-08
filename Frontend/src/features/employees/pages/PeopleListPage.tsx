import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Star,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { useEmployeesList, type PublicProfile } from "../api/hooks";
import { useAppSelector } from "@/app/hooks";

// ---------------------------------------------------------------------------
// Filtering + stats
// ---------------------------------------------------------------------------

type PeopleFilter = "ALL" | "ACTIVE" | "INACTIVE" | "PM";

const FILTERS: { value: PeopleFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "PM", label: "Project Mgrs" },
];

interface PeopleStats {
  total: number;
  active: number;
  inactive: number;
  pms: number;
}

function deriveStats(items: PublicProfile[]): PeopleStats {
  let active = 0;
  let inactive = 0;
  let pms = 0;
  for (const p of items) {
    if (p.isActive) active += 1;
    else inactive += 1;
    if (p.isProjectManager) pms += 1;
  }
  return { total: items.length, active, inactive, pms };
}

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
  value: PeopleFilter;
  onChange: (next: PeopleFilter) => void;
  counts: Record<PeopleFilter, number>;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter people"
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

export function PeopleListPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("ALL");
  const me = useAppSelector((s) => s.auth.user);
  // Fetch a wider set than we paginate so the KPI counts reflect the full
  // dataset, not just the current page.
  const { data, isLoading } = useEmployeesList({ q, page: 1, limit: 200 });
  const canReviewCandidates = me?.role === "HR" || me?.role === "ADMIN";

  const allItems = data?.items ?? [];
  const stats = useMemo(() => deriveStats(allItems), [allItems]);
  const counts: Record<PeopleFilter, number> = {
    ALL: stats.total,
    ACTIVE: stats.active,
    INACTIVE: stats.inactive,
    PM: stats.pms,
  };

  const filtered = useMemo(() => {
    return allItems.filter((p) => {
      if (filter === "ACTIVE" && !p.isActive) return false;
      if (filter === "INACTIVE" && p.isActive) return false;
      if (filter === "PM" && !p.isProjectManager) return false;
      return true;
    });
  }, [allItems, filter]);

  const paginated = usePagination(filtered, 10);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="People & Org · Directory"
        title="People"
        description="The directory of everyone at Global NeoChain. New joiners self-register and flow through HR + Admin review."
        actions={
          canReviewCandidates ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/people/candidates">Review candidates</Link>
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
      ) : allItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Total people"
            value={String(stats.total)}
            hint={`${stats.active} active · ${stats.inactive} inactive`}
            icon={<Users className="h-4 w-4" />}
            tone="primary"
          />
          <KpiTile
            label="Active"
            value={String(stats.active)}
            hint={
              stats.total > 0
                ? `${Math.round((stats.active / stats.total) * 100)}% of roster`
                : undefined
            }
            icon={<UserCheck className="h-4 w-4" />}
            tone="success"
          />
          <KpiTile
            label="Inactive"
            value={String(stats.inactive)}
            hint={stats.inactive === 0 ? "All clear" : "Worth reviewing"}
            icon={<UserMinus className="h-4 w-4" />}
            tone={stats.inactive > 0 ? "warn" : "default"}
          />
          <KpiTile
            label="Project managers"
            value={String(stats.pms)}
            hint={stats.pms === 1 ? "PM on staff" : "PMs on staff"}
            icon={<Star className="h-4 w-4" />}
            tone="default"
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* Toolbar: search + filter pills */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="lg:max-w-md lg:flex-1">
              <SearchBar
                value={q}
                onChange={setQ}
                placeholder="Search by name or email…"
                ariaLabel="Search employees"
              />
            </div>
            {allItems.length > 0 && (
              <FilterPills value={filter} onChange={setFilter} counts={counts} />
            )}
          </div>

          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-border/60 bg-card/40 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                No people yet
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                When someone self-registers and clears the HR + Admin approval
                pipeline, they'll appear here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
              No people match this filter.
            </div>
          ) : (
            <>
              {/* Mobile: card stack (< md) */}
              <div className="space-y-3 md:hidden">
                {paginated.items.map((p) => {
                  const initials = p.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <Link
                      key={p.id}
                      to={`/people/${p.id}`}
                      className={cn(
                        "block rounded-md border border-border/60 bg-card/40 p-3.5 shadow-sm transition-colors hover:border-primary/50 hover:bg-card/70",
                        !p.isActive && "opacity-60",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-foreground">
                              {p.name}
                            </span>
                            {p.isProjectManager && (
                              <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                PM
                              </span>
                            )}
                            <StatusBadge tone={p.isActive ? "success" : "default"} className="ml-auto">
                              {p.isActive ? "Active" : "Inactive"}
                            </StatusBadge>
                          </div>
                          {p.jobTitle && (
                            <div className="mt-0.5 truncate text-sm text-muted-foreground">
                              {p.jobTitle}
                              {p.departmentName ? ` · ${p.departmentName}` : ""}
                            </div>
                          )}
                          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                            {p.email}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop: table (md+) */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-2">Name</TableHead>
                      <TableHead className="px-2">Title</TableHead>
                      <TableHead className="px-2">Department</TableHead>
                      <TableHead className="px-2">Email</TableHead>
                      <TableHead className="px-2 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.items.map((p) => {
                      const initials = p.name
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <TableRow key={p.id} className={!p.isActive ? "opacity-60" : undefined}>
                          <TableCell className="px-2 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{p.name}</span>
                                  {p.isProjectManager && (
                                    <span
                                      className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                                      title="Project Manager"
                                    >
                                      PM
                                    </span>
                                  )}
                                </div>
                                <StatusBadge tone={p.isActive ? "success" : "default"}>
                                  {p.isActive ? "Active" : "Inactive"}
                                </StatusBadge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                              {p.jobTitle ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-muted-foreground">
                            {p.departmentName ?? "—"}
                          </TableCell>
                          <TableCell className="px-2 py-3 font-mono text-xs text-muted-foreground">
                            {p.email}
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right">
                            <Link
                              to={`/people/${p.id}`}
                              className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
    </PageContainer>
  );
}
