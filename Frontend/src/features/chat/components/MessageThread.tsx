import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatMessage, Conversation } from "../api/hooks";

interface Props {
  conversation: Conversation;
  meId: string | undefined;
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (body: string) => Promise<void> | void;
  isSending: boolean;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function otherName(c: Conversation, meId: string | undefined): string {
  const other = meId
    ? c.participants.find((p) => p.id !== meId)
    : c.participants[0];
  return other?.name ?? "Conversation";
}

export function MessageThread({
  conversation,
  meId,
  messages,
  isLoading,
  onSend,
  isSending,
}: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The list is rendered oldest-at-top, so scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    await onSend(trimmed);
    setDraft("");
  }

  // The API returns newest first; render oldest-first by reversing.
  const ordered = [...messages].reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-medium">{otherName(conversation, meId)}</div>
        <div className="text-xs text-muted-foreground">Direct message</div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hi.
          </div>
        ) : (
          ordered.map((m) => {
            const mine = m.authorId === meId;
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.body}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {mine ? "You" : m.authorName ?? "Unknown"} · {fmtTime(m.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-border px-3 py-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          rows={2}
          maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e as unknown as FormEvent);
            }
          }}
          className="flex min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={isSending || draft.trim().length === 0}>
          {isSending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
