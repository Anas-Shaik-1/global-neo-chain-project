import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  Phone,
  X,
} from "lucide-react";
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
  onSend: (body: string, file?: File) => Promise<void> | void;
  isSending: boolean;
}

const ATTACHMENT_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
].join(",");

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB — matches backend limit

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
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

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
}

function MessageBubble({ message, mine }: MessageBubbleProps) {
  const hasAttachment = !!message.attachmentUrl;
  const isImage = hasAttachment && isImageMime(message.attachmentMimeType);
  const hasBody = (message.body ?? "").trim().length > 0;

  return (
    <div
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-2 rounded-2xl px-3 py-2 text-sm",
          mine
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {hasAttachment && isImage && (
          <a
            href={message.attachmentUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-md"
            title={message.attachmentName ?? "Image attachment"}
          >
            <img
              src={message.attachmentUrl ?? ""}
              alt={message.attachmentName ?? "attachment"}
              loading="lazy"
              className="block max-h-64 max-w-[240px] rounded-md object-cover"
            />
          </a>
        )}
        {hasAttachment && !isImage && (
          <a
            href={message.attachmentUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 transition-colors",
              mine
                ? "border-primary-foreground/30 hover:bg-primary-foreground/10"
                : "border-border bg-background hover:bg-accent",
            )}
          >
            <FileText className="h-4 w-4 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">
                {message.attachmentName ?? "Attachment"}
              </div>
              {typeof message.attachmentSize === "number" && (
                <div
                  className={cn(
                    "text-[10px]",
                    mine
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {formatBytes(message.attachmentSize)}
                </div>
              )}
            </div>
          </a>
        )}
        {hasBody && <div className="whitespace-pre-wrap">{message.body}</div>}
      </div>
    </div>
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const call = useCall();
  const peer = otherParticipant(conversation, meId);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

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

  // Revoke object URL on cleanup or replacement to avoid leaks.
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  function clearPending() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setPendingFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_ATTACHMENT_BYTES) {
      setFileError(`File is too large (max ${formatBytes(MAX_ATTACHMENT_BYTES)}).`);
      e.target.value = "";
      return;
    }
    setFileError(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(f);
    setPendingPreviewUrl(
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    );
  }

  async function onSubmit(values: ChatMessageValues) {
    const trimmed = values.body.trim();
    if (isSending) return;
    if (!trimmed && !pendingFile) return;
    await onSend(trimmed, pendingFile ?? undefined);
    form.reset({ body: "" });
    clearPending();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void form.handleSubmit(onSubmit)();
    }
  }

  // The API returns newest first; render oldest-first by reversing.
  const ordered = [...messages].reverse();
  const canSend = !isSending && (draft.trim().length > 0 || !!pendingFile);

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
              <div key={m.id} className="flex flex-col gap-1">
                <MessageBubble message={m} mine={mine} />
                <div
                  className={cn(
                    "text-[10px] text-muted-foreground",
                    mine ? "self-end" : "self-start",
                  )}
                >
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
          className="flex flex-col gap-2 border-t border-border px-3 py-3"
          noValidate
        >
          {pendingFile && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs">
              {pendingPreviewUrl ? (
                <img
                  src={pendingPreviewUrl}
                  alt="preview"
                  className="h-9 w-9 shrink-0 rounded object-cover"
                />
              ) : pendingFile.type.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{pendingFile.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatBytes(pendingFile.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={clearPending}
                aria-label="Remove attached file"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {fileError && (
            <div className="text-xs text-destructive">{fileError}</div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={onPickFile}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a file"
              title="Attach a file"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem className="flex-1 space-y-0">
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={4000}
                      placeholder={
                        pendingFile
                          ? "Add a caption (optional)…"
                          : "Type a message..."
                      }
                      className="min-h-[44px] resize-none"
                      {...field}
                      onKeyDown={onKeyDown}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={!canSend}>
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
