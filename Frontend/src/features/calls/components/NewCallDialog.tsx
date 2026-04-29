import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meId: string | undefined;
  onPick: (userId: string, userName: string) => void;
}

export function NewCallDialog({ open, onOpenChange, meId, onPick }: Props) {
  const form = useForm<NewCallSearchValues>({
    resolver: zodResolver(NewCallSearchSchema),
    defaultValues: { query: "" },
  });
  const query = form.watch("query");
  const list = useEmployeesList({ q: query || undefined, limit: 20 });

  const candidates = useMemo(
    () => (list.data?.items ?? []).filter((u) => u.id !== meId && u.isActive),
    [list.data, meId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New call</DialogTitle>
          <DialogDescription>
            Pick a teammate to start a video call with.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-3" noValidate onSubmit={(e) => e.preventDefault()}>
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
                        onClick={() => onPick(u.id, u.name)}
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
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
