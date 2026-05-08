import { useState } from "react";
import {
  Lightbulb,
  MessageSquareWarning,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer } from "@/components/common/PageContainer";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  type FeedbackEntry,
  type FeedbackKind,
  type FeedbackStatus,
  useFeedbackList,
  useReviewFeedback,
  useSubmitFeedback,
} from "../api/hooks";

const KIND_LABEL: Record<FeedbackKind, string> = {
  SUGGESTION: "Suggestion",
  COMPLAINT: "Complaint",
};

const STATUS_TONE: Record<FeedbackStatus, "warn" | "info" | "success"> = {
  OPEN: "warn",
  REVIEWED: "info",
  ACTIONED: "success",
};

/**
 * Suggestions & Complaints. Two audiences:
 *   • Submitter: any active employee. Drops a subject + body and an
 *     optional anonymity toggle. Their own list shows only their entries.
 *   • Reviewer (HR + Admin): triages every entry, can flip status and
 *     leave an internal note.
 */
export function FeedbackPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isReviewer = role === "HR" || role === "ADMIN";
  const [submitOpen, setSubmitOpen] = useState(false);

  return (
    <PageContainer width="default" className="space-y-6">
      <PageHeader
        eyebrow="Feedback"
        title="Suggestions & complaints"
        description="Share what's working and what isn't. You can post anonymously — only HR and Admin can see who anonymous entries belong to, and only when follow-up requires it."
        actions={
          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New entry
              </Button>
            </DialogTrigger>
            <SubmitDialog onSubmitted={() => setSubmitOpen(false)} />
          </Dialog>
        }
      />

      {isReviewer ? (
        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queue">Triage queue</TabsTrigger>
            <TabsTrigger value="mine">My entries</TabsTrigger>
          </TabsList>
          <TabsContent value="queue">
            <FeedbackList
              params={{}}
              isReviewer
              emptyHint="Nothing to triage yet."
            />
          </TabsContent>
          <TabsContent value="mine">
            <FeedbackList
              params={{ mine: true }}
              isReviewer
              emptyHint="You haven't filed anything yet."
            />
          </TabsContent>
        </Tabs>
      ) : (
        <FeedbackList
          params={{ mine: true }}
          isReviewer={false}
          emptyHint="You haven't filed anything yet. Click New entry to get started."
        />
      )}
    </PageContainer>
  );
}

const SubmitSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Description is required").max(5000),
  isAnonymous: z.boolean(),
});

function SubmitDialog({ onSubmitted }: { onSubmitted: () => void }) {
  const submit = useSubmitFeedback();
  const form = useForm<z.infer<typeof SubmitSchema>>({
    resolver: zodResolver(SubmitSchema),
    defaultValues: {
      kind: "SUGGESTION",
      subject: "",
      body: "",
      isAnonymous: false,
    },
  });

  async function onSubmit(values: z.infer<typeof SubmitSchema>) {
    try {
      await submit.mutateAsync(values);
      form.reset({
        kind: "SUGGESTION",
        subject: "",
        body: "",
        isAnonymous: false,
      });
      onSubmitted();
    } catch {
      // toast already fires inside the hook
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Submit feedback</DialogTitle>
        <DialogDescription>
          Your entry goes straight to HR. Choose anonymous if you'd rather not
          attach your name — your identity is still recorded server-side for
          abuse prevention but only HR/Admin can lift the veil.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kind</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FEEDBACK_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl>
                  <Input
                    placeholder="A short headline (e.g. Coffee machine is broken)"
                    maxLength={200}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Details</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    maxLength={5000}
                    placeholder="As much detail as you'd like — context, suggestions, what would help."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isAnonymous"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="anon" className="cursor-pointer text-sm font-medium">
                    Submit anonymously
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    HR will see "anonymous teammate" instead of your name on
                    the triage queue.
                  </p>
                </div>
                <Switch
                  id="anon"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormItem>
            )}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="submit"
              disabled={submit.isPending || form.formState.isSubmitting}
            >
              {submit.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

interface FeedbackListProps {
  params: { mine?: boolean; status?: FeedbackStatus; kind?: FeedbackKind };
  isReviewer: boolean;
  emptyHint: string;
}

function FeedbackList({ params, isReviewer, emptyHint }: FeedbackListProps) {
  const q = useFeedbackList({ ...params, limit: 100 });
  const items = q.data?.items ?? [];
  const paginated = usePagination(items, 10);

  if (q.isLoading || !q.data) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-10">
          <div className="flex flex-col items-center text-center">
            <Lightbulb className="mb-3 h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">
              Nothing here yet
            </div>
            <div className="mt-1 max-w-sm text-xs text-muted-foreground">
              {emptyHint}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          {paginated.totalItems}{" "}
          {paginated.totalItems === 1 ? "entry" : "entries"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-3">
          {paginated.items.map((entry) => (
            <FeedbackRow
              key={entry.id}
              entry={entry}
              isReviewer={isReviewer}
            />
          ))}
        </ul>
        <Pagination
          page={paginated.page}
          pageSize={paginated.pageSize}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          onPageChange={paginated.setPage}
          onPageSizeChange={paginated.setPageSize}
          noun="entries"
        />
      </CardContent>
    </Card>
  );
}

function FeedbackRow({
  entry,
  isReviewer,
}: {
  entry: FeedbackEntry;
  isReviewer: boolean;
}) {
  const Icon =
    entry.kind === "SUGGESTION" ? Lightbulb : MessageSquareWarning;
  const submittedAt = new Date(entry.createdAt).toLocaleString();
  const author = entry.isAnonymous
    ? "Anonymous"
    : entry.submitterName ?? "Unknown";

  return (
    <li className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            entry.kind === "SUGGESTION"
              ? "bg-amber-500/15 text-amber-400"
              : "bg-rose-500/15 text-rose-400",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {entry.kind}
            </span>
            <StatusBadge tone={STATUS_TONE[entry.status]}>
              {entry.status}
            </StatusBadge>
            {entry.isAnonymous && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Anonymous
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
              {submittedAt}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {entry.subject}
          </div>
          <div className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {entry.body}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Filed by{" "}
            <span className="font-medium text-foreground/80">{author}</span>
            {entry.reviewedAt && entry.reviewedByName && (
              <>
                {" · reviewed by "}
                <span className="font-medium text-foreground/80">
                  {entry.reviewedByName}
                </span>
                {" "}
                <span className="text-muted-foreground/70">
                  ({new Date(entry.reviewedAt).toLocaleDateString()})
                </span>
              </>
            )}
          </div>
          {entry.reviewNote && (
            <div className="mt-2 rounded-md border border-border/40 bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Internal note ·{" "}
              </span>
              {entry.reviewNote}
            </div>
          )}

          {isReviewer && (
            <ReviewerActions entry={entry} />
          )}
        </div>
      </div>
    </li>
  );
}

function ReviewerActions({ entry }: { entry: FeedbackEntry }) {
  const review = useReviewFeedback(entry.id);
  const [note, setNote] = useState(entry.reviewNote ?? "");

  function setStatus(s: FeedbackStatus) {
    review.mutate({ status: s, reviewNote: note.trim() ? note.trim() : undefined });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Internal note (optional)"
        maxLength={1000}
        className="h-8 max-w-md text-xs"
      />
      {FEEDBACK_STATUSES.filter((s) => s !== entry.status).map((s) => (
        <Button
          key={s}
          variant="outline"
          size="sm"
          disabled={review.isPending}
          onClick={() => setStatus(s)}
          className="text-xs"
        >
          Mark {s.toLowerCase()}
        </Button>
      ))}
    </div>
  );
}
