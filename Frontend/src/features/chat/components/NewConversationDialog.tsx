import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeesList } from "@/features/employees/api/hooks";
import { useOpenConversation } from "../api/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meId: string | undefined;
  onOpened: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, meId, onOpened }: Props) {
  const [query, setQuery] = useState("");
  const list = useEmployeesList({ q: query || undefined, limit: 20 });
  const openConvo = useOpenConversation();
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => (list.data?.items ?? []).filter((u) => u.id !== meId),
    [list.data, meId],
  );

  async function handlePick(userId: string) {
    setError(null);
    try {
      const c = await openConvo.mutateAsync(userId);
      onOpenChange(false);
      setQuery("");
      onOpened(c.id);
    } catch (err) {
      setError((err as Error).message ?? "Failed to open conversation");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>Pick a teammate to start a direct message with.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="chat-search">Search teammates</Label>
            <Input
              id="chat-search"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
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
                      onClick={() => handlePick(u.id)}
                      disabled={openConvo.isPending}
                      className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      <span className="text-xs text-muted-foreground">{u.jobTitle ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && (
            <div role="alert" className="text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
