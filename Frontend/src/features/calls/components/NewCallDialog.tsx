import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEmployeesList } from "@/features/employees/api/hooks";
import { NewCallSearchSchema, type NewCallSearchValues } from "../schemas";
import type { PeerInfo } from "../CallProvider";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meId: string | undefined;
  onPick: (peers: PeerInfo[]) => void;
}

type Mode = "direct" | "group";

const MAX_GROUP_PEERS = 3; // mesh max 4 total (initiator + 3)

export function NewCallDialog({ open, onOpenChange, meId, onPick }: Props) {
  const form = useForm<NewCallSearchValues>({
    resolver: zodResolver(NewCallSearchSchema),
    defaultValues: { query: "" },
  });
  const query = form.watch("query");
  const list = useEmployeesList({ q: query || undefined, limit: 20 });

  const [mode, setMode] = useState<Mode>("direct");
  const [selected, setSelected] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => (list.data?.items ?? []).filter((u) => u.id !== meId && u.isActive),
    [list.data, meId],
  );

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setSelected([]);
      setError(null);
      form.reset({ query: "" });
    }
  }

  function toggleSelect(userId: string, name: string) {
    setError(null);
    setSelected((cur) => {
      const has = cur.some((p) => p.userId === userId);
      if (has) return cur.filter((p) => p.userId !== userId);
      if (cur.length >= MAX_GROUP_PEERS) {
        setError(`Group calls support up to ${MAX_GROUP_PEERS + 1} participants total.`);
        return cur;
      }
      return [...cur, { userId, name }];
    });
  }

  function startGroup() {
    if (selected.length === 0) {
      setError("Pick at least one teammate.");
      return;
    }
    onPick(selected);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New call</DialogTitle>
          <DialogDescription>
            Start a 1-on-1 call or ring up to 3 teammates at once.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            setError(null);
            setSelected([]);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-3 pt-3">
            <Form {...form}>
              <form noValidate onSubmit={(e) => e.preventDefault()}>
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search teammates</FormLabel>
                      <FormControl>
                        <Input placeholder="Search by name or email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <div className="max-h-[320px] overflow-y-auto rounded-md border border-border">
              {list.isLoading ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No teammates found.
                </div>
              ) : (
                <ul>
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() =>
                          onPick([{ userId: u.id, name: u.name }])
                        }
                        className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {u.jobTitle ?? ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-3 pt-3">
            <Form {...form}>
              <form noValidate onSubmit={(e) => e.preventDefault()}>
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Add teammates{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({selected.length} / {MAX_GROUP_PEERS} selected)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Search by name or email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
              {list.isLoading ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No teammates found.
                </div>
              ) : (
                <ul>
                  {candidates.map((u) => {
                    const checked = selected.some((p) => p.userId === u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(u.id, u.name)}
                          aria-pressed={checked}
                          className={cn(
                            "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-accent",
                            checked && "bg-accent/60",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background",
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{u.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {u.email}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {u.jobTitle ?? ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          {mode === "group" && (
            <Button
              type="button"
              onClick={startGroup}
              disabled={selected.length === 0}
            >
              Start group call
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
