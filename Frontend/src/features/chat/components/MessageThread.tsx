import { useEffect, useRef, type KeyboardEvent } from "react";
import { Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useCall } from "@/features/calls/CallProvider";
import type { ChatMessage, Conversation } from "../api/hooks";
import { ChatMessageSchema, type ChatMessageValues } from "../schemas";

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

function otherParticipant(
  c: Conversation,
  meId: string | undefined,
): { id: string; name: string } | null {
  const other = meId
    ? c.participants.find((p) => p.id !== meId)
    : c.participants[0];
  return other ? { id: other.id, name: other.name } : null;
}

export function MessageThread({
  conversation,
  meId,
  messages,
  isLoading,
  onSend,
  isSending,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const call = useCall();
  const peer = otherParticipant(conversation, meId);

  const form = useForm<ChatMessageValues>({
    resolver: zodResolver(ChatMessageSchema),
    defaultValues: { body: "" },
  });
  const draft = form.watch("body");

  // The list is rendered oldest-at-top, so scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.id]);

  async function onSubmit(values: ChatMessageValues) {
    const trimmed = values.body.trim();
    if (!trimmed || isSending) return;
    await onSend(trimmed);
    form.reset({ body: "" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void form.handleSubmit(onSubmit)();
    }
  }

  // The API returns newest first; render oldest-first by reversing.
  const ordered = [...messages].reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-medium">{otherName(conversation, meId)}</div>
          <div className="text-xs text-muted-foreground">Direct message</div>
        </div>
        {peer && (
          <button
            type="button"
            onClick={() => {
              void call.start(peer.id, peer.name);
            }}
            aria-label={`Call ${peer.name}`}
            title={`Call ${peer.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Phone className="h-4 w-4" />
          </button>
        )}
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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-end gap-2 border-t border-border px-3 py-3"
          noValidate
        >
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem className="flex-1 space-y-0">
                <FormControl>
                  <Textarea
                    rows={2}
                    maxLength={4000}
                    placeholder="Type a message..."
                    className="min-h-[44px] resize-none"
                    {...field}
                    onKeyDown={onKeyDown}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSending || draft.trim().length === 0}>
            {isSending ? "Sending..." : "Send"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
