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
import { useCreateGroup, useOpenConversation } from "../api/hooks";
import {
  NewConversationSearchSchema,
  type NewConversationSearchValues,
} from "../schemas";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meId: string | undefined;
  onOpened: (conversationId: string) => void;
}

type Mode = "dm" | "group";

export function NewConversationDialog({ open, onOpenChange, meId, onOpened }: Props) {
  const form = useForm<NewConversationSearchValues>({
    resolver: zodResolver(NewConversationSearchSchema),
    defaultValues: { query: "" },
  });
  const query = form.watch("query");
  const list = useEmployeesList({ q: query || undefined, limit: 20 });
  const openConvo = useOpenConversation();
  const createGroup = useCreateGroup();

  const [mode, setMode] = useState<Mode>("dm");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => (list.data?.items ?? []).filter((u) => u.id !== meId),
    [list.data, meId],
  );

  function reset() {
    form.reset({ query: "" });
    setGroupName("");
    setSelected([]);
    setError(null);
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  async function handlePickDm(userId: string) {
    setError(null);
    try {
      const c = await openConvo.mutateAsync(userId);
      handleClose(false);
      onOpened(c.id);
    } catch (err) {
      setError((err as Error).message ?? "Failed to open conversation");
    }
  }

  function toggleSelect(userId: string) {
    setSelected((cur) =>
      cur.includes(userId)
        ? cur.filter((id) => id !== userId)
        : [...cur, userId],
    );
  }

  async function handleCreateGroup() {
    setError(null);
    const name = groupName.trim();
    if (!name) {
      setError("Group name is required");
      return;
    }
    if (selected.length < 1) {
      setError("Pick at least one teammate");
      return;
    }
    try {
      const c = await createGroup.mutateAsync({
        name,
        participantIds: selected,
      });
      handleClose(false);
      onOpened(c.id);
    } catch (err) {
      setError((err as Error).message ?? "Failed to create group");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Start a direct message with one teammate or a group with several.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dm">Direct message</TabsTrigger>
            <TabsTrigger value="group">Group chat</TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="space-y-3 pt-3">
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
                        onClick={() => handlePickDm(u.id)}
                        disabled={openConvo.isPending}
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
            <div className="space-y-1.5">
              <label
                htmlFor="group-name-input"
                className="text-sm font-medium"
              >
                Group name
              </label>
              <Input
                id="group-name-input"
                placeholder="e.g. Project Falcon"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={100}
              />
            </div>
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
                          ({selected.length} selected)
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
                    const checked = selected.includes(u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(u.id)}
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
              onClick={handleCreateGroup}
              disabled={
                createGroup.isPending ||
                groupName.trim().length === 0 ||
                selected.length === 0
              }
            >
              {createGroup.isPending ? "Creating…" : "Create group"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
