import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Archive,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Phone,
  Play,
  Pause,
  Send,
  Square,
  UserMinus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { useCall } from "@/features/calls/CallProvider";
import { PreCallDialog, type PreCallOptions } from "@/features/calls/components/PreCallDialog";
import {
  useRemoveGroupMember,
  type ChatMessage,
  type Conversation,
} from "../api/hooks";
import { ChatMessageSchema, type ChatMessageValues } from "../schemas";

interface Props {
  conversation: Conversation;
  meId: string | undefined;
  messages: ChatMessage[];
  isLoading: boolean;
  /** True while there are older pages on the server. */
  hasMore?: boolean;
  /** True while the next-older page is in-flight. */
  isLoadingMore?: boolean;
  /** Fired when the user scrolls near the top of the thread. */
  onLoadMore?: () => void;
  onSend: (body: string, file?: File) => Promise<void> | void;
  isSending: boolean;
}


const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB — matches backend limit

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns a Cliq/WhatsApp-style date label ("Today" / "Yesterday" / "Wed,
 * Apr 24" / "Mar 12, 2025") for a message timestamp. Used in date dividers
 * between message groups so users can scan the thread by day.
 */
function fmtDateDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (today.getTime() - messageDay.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isoDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

function isAudioMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("audio/");
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * WhatsApp-style file-type chip — different icon + tone per mime family so
 * a PDF / spreadsheet / archive / generic doc all read distinct at a glance
 * in the message stream.
 */
interface AttachmentChip {
  Icon: LucideIcon;
  /** Tailwind tone tokens for the icon-tile background and icon color. */
  tile: string;
  icon: string;
  /** Short uppercase tag rendered as a fallback "extension" pill. */
  tag: string;
}

function chipForAttachment(
  mime: string | null | undefined,
  name: string | null | undefined,
): AttachmentChip {
  const m = (mime ?? "").toLowerCase();
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";

  if (m === "application/pdf" || ext === "pdf") {
    return { Icon: FileText, tile: "bg-red-500/15", icon: "text-red-400", tag: "PDF" };
  }
  if (
    m.includes("spreadsheet") ||
    m === "application/vnd.ms-excel" ||
    ext === "xls" ||
    ext === "xlsx" ||
    ext === "csv" ||
    m === "text/csv"
  ) {
    return {
      Icon: FileSpreadsheet,
      tile: "bg-emerald-500/15",
      icon: "text-emerald-400",
      tag: ext === "csv" ? "CSV" : "XLS",
    };
  }
  if (m.includes("word") || ext === "doc" || ext === "docx") {
    return { Icon: FileText, tile: "bg-blue-500/15", icon: "text-blue-400", tag: "DOC" };
  }
  if (m === "application/zip" || ext === "zip" || ext === "tar" || ext === "gz") {
    return { Icon: Archive, tile: "bg-amber-500/15", icon: "text-amber-400", tag: "ZIP" };
  }
  if (m === "text/plain" || ext === "txt") {
    return { Icon: FileText, tile: "bg-muted", icon: "text-muted-foreground", tag: "TXT" };
  }
  return {
    Icon: FileIcon,
    tile: "bg-muted",
    icon: "text-muted-foreground",
    tag: ext.toUpperCase().slice(0, 4) || "FILE",
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

function dmOther(
  c: Conversation,
  meId: string | undefined,
): { id: string; name: string } | null {
  const other = meId
    ? c.participants.find((p) => p.id !== meId)
    : c.participants[0];
  return other ? { id: other.id, name: other.name } : null;
}

function headerName(c: Conversation, meId: string | undefined): string {
  if (c.kind === "GROUP") return c.name ?? "Group";
  const other = dmOther(c, meId);
  return other?.name ?? "Conversation";
}

/**
 * Inline voice-message player. Uses a hidden <audio> element + custom UI so
 * the bubble can match the rest of the chat (no native browser controls).
 * Supports play/pause, a thin progress bar, and a duration readout.
 */
function VoiceMessage({
  url,
  mine,
  sizeBytes,
}: {
  url: string;
  mine: boolean;
  sizeBytes: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () =>
      setDuration(Number.isFinite(a.duration) ? a.duration : null);
    const onTime = () => setPosition(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setPosition(0);
    };
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  const ratio =
    duration && duration > 0 ? Math.min(1, position / duration) : 0;
  const display =
    duration === null
      ? "—:—"
      : playing || position > 0
        ? `${formatDuration(position)} / ${formatDuration(duration)}`
        : formatDuration(duration);

  return (
    <div
      className={cn(
        "flex min-w-[200px] items-center gap-2 rounded-lg px-2 py-1.5",
        mine ? "bg-primary-foreground/10" : "bg-muted/40",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          mine
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground",
        )}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "h-1 w-full overflow-hidden rounded-full",
            mine ? "bg-primary-foreground/30" : "bg-foreground/15",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full",
              mine ? "bg-primary-foreground" : "bg-primary",
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <div
          className={cn(
            "mt-1 flex items-center justify-between font-mono text-[10px]",
            mine ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          <span>{display}</span>
          {sizeBytes !== null && <span>{formatBytes(sizeBytes)}</span>}
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  showAuthor: boolean;
  /** First in a same-author run — gets the full "head" corner. */
  runStart?: boolean;
  /** Last in a same-author run — gets the "tail" corner sharpened. */
  runEnd?: boolean;
}

function MessageBubble({
  message,
  mine,
  showAuthor,
  runStart = true,
  runEnd = true,
}: MessageBubbleProps) {
  const hasAttachment = !!message.attachmentUrl;
  const isImage = hasAttachment && isImageMime(message.attachmentMimeType);
  const isAudio = hasAttachment && isAudioMime(message.attachmentMimeType);
  const hasBody = (message.body ?? "").trim().length > 0;

  // Cliq-style chat tail: in a run of consecutive messages from the same
  // author, the *last* bubble keeps a smaller corner on the side closest
  // to the author indicator (right for mine, left for theirs). Bubbles in
  // the middle of a run get fully-tightened corners on that side.
  const tailCorner = mine
    ? cn(runEnd && "rounded-br-md", !runStart && "rounded-tr-md")
    : cn(runEnd && "rounded-bl-md", !runStart && "rounded-tl-md");

  return (
    <div
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      {showAuthor && !mine && (
        <span className="px-3 text-[11px] font-medium text-primary">
          {message.authorName ?? "Unknown"}
        </span>
      )}
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-2 rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          mine
            ? "bg-primary text-primary-foreground"
            : "border border-border/50 bg-card text-foreground",
          tailCorner,
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
        {hasAttachment && isAudio && (
          <VoiceMessage
            url={message.attachmentUrl ?? ""}
            mine={mine}
            sizeBytes={
              typeof message.attachmentSize === "number"
                ? message.attachmentSize
                : null
            }
          />
        )}
        {hasAttachment && !isImage && !isAudio && (() => {
          const chip = chipForAttachment(
            message.attachmentMimeType,
            message.attachmentName,
          );
          return (
            <a
              href={message.attachmentUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex min-w-[200px] items-center gap-3 rounded-md border px-2.5 py-2 transition-colors",
                mine
                  ? "border-primary-foreground/30 hover:bg-primary-foreground/10"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  chip.tile,
                )}
              >
                <chip.Icon className={cn("h-5 w-5", chip.icon)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {message.attachmentName ?? "Attachment"}
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-[10px]",
                    mine ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  <span className="font-mono font-semibold tracking-wider">
                    {chip.tag}
                  </span>
                  {typeof message.attachmentSize === "number" && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatBytes(message.attachmentSize)}</span>
                    </>
                  )}
                </div>
              </div>
            </a>
          );
        })()}
        {hasBody && <div className="whitespace-pre-wrap">{message.body}</div>}
      </div>
    </div>
  );
}

interface MembersSheetProps {
  conversation: Conversation;
  meId: string | undefined;
}

function MembersSheet({ conversation, meId }: MembersSheetProps) {
  const removeMember = useRemoveGroupMember(conversation.id);
  const isCreator = !!meId && conversation.createdById === meId;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="text-left"
          aria-label="View group members"
        >
          <div className="text-sm font-medium hover:underline">
            {conversation.name ?? "Group"}
          </div>
          <div className="text-xs text-muted-foreground">
            {conversation.participants.length} members
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Group
            </div>
            <div className="font-display text-lg font-semibold">
              {conversation.name ?? "Group"}
            </div>
            <div className="text-xs text-muted-foreground">
              {conversation.participants.length} members
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {conversation.participants.map((p) => {
              const canRemove = isCreator && p.id !== meId;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {p.avatarUrl ? (
                      <AvatarImage src={p.avatarUrl} alt={p.name} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {initials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {p.name}
                      {p.id === meId && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                      {p.id === conversation.createdById && (
                        <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Creator
                        </span>
                      )}
                    </div>
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        void removeMember.mutateAsync(p.id);
                      }}
                      disabled={removeMember.isPending}
                      aria-label={`Remove ${p.name} from group`}
                      title="Remove from group"
                      className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MessageThread({
  conversation,
  meId,
  messages,
  isLoading,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSend,
  isSending,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Two file inputs: one filtered to images/photos+video, the other to
  // documents only — driven by the WhatsApp-style attachment-type menu so
  // the OS file picker only shows the relevant subset.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Composer textarea auto-grow: starts at 1 row, grows up to 4 rows as
  // newlines are entered, then becomes scrollable. Implemented by clearing
  // the inline height on every change and clamping to a 4-row max derived
  // from computed line-height + vertical padding.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const MAX_TEXTAREA_ROWS = 4;
  const call = useCall();
  const isGroup = conversation.kind === "GROUP";
  const dmPeer = isGroup ? null : dmOther(conversation, meId);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordingTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Pre-call confirmation dialog: target peer(s) + the dialog's open state.
  const [preCallTarget, setPreCallTarget] = useState<
    { peerIds: string[]; peerInfos: { userId: string; name: string }[] } | null
  >(null);

  const form = useForm<ChatMessageValues>({
    resolver: zodResolver(ChatMessageSchema),
    defaultValues: { body: "" },
  });
  const draft = form.watch("body");

  // Track the latest message id and the scrollHeight before history loads
  // so we can:
  //   • auto-scroll to the bottom only when a *new* message arrives (the
  //     latest id changed), not when older history is prepended
  //   • preserve the visible viewport when older history is prepended by
  //     adjusting scrollTop by the height delta
  const latestIdRef = useRef<string | null>(null);
  const preLoadHeightRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Newest message: messages array is newest-first; reverse[last] === messages[0].
    const newest = messages[0]?.id ?? null;
    const newestChanged = newest !== latestIdRef.current;

    if (preLoadHeightRef.current !== null) {
      // Older page just landed — keep the user's reading position pinned by
      // shifting scrollTop by the new content's height.
      const delta = el.scrollHeight - preLoadHeightRef.current;
      el.scrollTop += delta;
      preLoadHeightRef.current = null;
    } else if (newestChanged) {
      // New message at the bottom — auto-scroll into view.
      el.scrollTop = el.scrollHeight;
    }

    latestIdRef.current = newest;
  }, [messages]);

  // Reset on conversation switch — jump to the bottom of the new thread.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    latestIdRef.current = messages[0]?.id ?? null;
    preLoadHeightRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Scroll-near-top detector: when the user scrolls within 80px of the top
  // and there's more history to fetch, capture the current scrollHeight and
  // call onLoadMore. The post-fetch effect above pins the viewport.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore) return;
    function handle() {
      if (!el) return;
      if (el.scrollTop > 80) return;
      if (!hasMore || isLoadingMore) return;
      preLoadHeightRef.current = el.scrollHeight;
      onLoadMore?.();
    }
    el.addEventListener("scroll", handle, { passive: true });
    return () => el.removeEventListener("scroll", handle);
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Revoke object URL on cleanup or replacement to avoid leaks.
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  // Auto-resize the composer textarea as the draft changes. We zero the
  // inline height first so `scrollHeight` reads the *natural* height of the
  // content, then clamp to a 4-row max. Beyond that the textarea is
  // scrollable thanks to the `overflow-y-auto` class on it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const verticalPadding =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const verticalBorder =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const maxHeight =
      lineHeight * MAX_TEXTAREA_ROWS + verticalPadding + verticalBorder;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [draft]);

  function clearPending() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setPendingFile(null);
    setFileError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  /**
   * Stop the active recorder (if any), tear down the mic stream, clear the
   * timer. Safe to call from any state — exits early if nothing is recording.
   */
  function stopRecorderHard() {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      try {
        r.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    recorderStreamRef.current?.getTracks().forEach((t) => t.stop());
    recorderStreamRef.current = null;
    if (recordingTickRef.current) {
      clearInterval(recordingTickRef.current);
      recordingTickRef.current = null;
    }
    setRecording(false);
    setRecordingSeconds(0);
  }

  // Hard cleanup on unmount or conversation switch — releases the mic.
  useEffect(() => () => stopRecorderHard(), []);

  async function startRecording() {
    if (recording || isSending) return;
    setFileError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setFileError("Voice messages need a browser with microphone access.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setFileError(
        "Microphone access was denied. Allow it in your browser settings to record.",
      );
      return;
    }
    // Pick the first MIME the browser actually supports — Chrome/Firefox
    // produce webm/opus, Safari produces mp4/aac. Both are accepted server-side.
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ];
    let mimeType = "";
    for (const c of candidates) {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported(c)
      ) {
        mimeType = c;
        break;
      }
    }
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    recorderChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recorderChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const chunks = recorderChunksRef.current;
      recorderChunksRef.current = [];
      const blobMime = mimeType.split(";")[0] || recorder.mimeType || "audio/webm";
      const ext =
        blobMime === "audio/mp4"
          ? "m4a"
          : blobMime === "audio/aac"
            ? "aac"
            : blobMime === "audio/mpeg"
              ? "mp3"
              : "webm";
      const blob = new Blob(chunks, { type: blobMime });
      if (blob.size === 0) return;
      const file = new File(
        [blob],
        `voice-${Date.now()}.${ext}`,
        { type: blobMime },
      );
      // Drop into the same `pendingFile` slot the rest of the composer uses
      // — the existing send flow uploads it as a chat attachment.
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingFile(file);
      setPendingPreviewUrl(null);
    };
    recorderRef.current = recorder;
    recorderStreamRef.current = stream;
    recorder.start();
    setRecording(true);
    setRecordingSeconds(0);
    recordingTickRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }

  function stopRecording() {
    // Triggers the `onstop` handler above which packages the blob into
    // pendingFile. Then tear down state without touching pendingFile.
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    recorderStreamRef.current?.getTracks().forEach((t) => t.stop());
    recorderStreamRef.current = null;
    recorderRef.current = null;
    if (recordingTickRef.current) {
      clearInterval(recordingTickRef.current);
      recordingTickRef.current = null;
    }
    setRecording(false);
    setRecordingSeconds(0);
  }

  function cancelRecording() {
    // Discard whatever's been captured. We swap onstop to a no-op so the
    // partial blob doesn't land in pendingFile.
    const r = recorderRef.current;
    if (r) r.onstop = null;
    recorderChunksRef.current = [];
    stopRecorderHard();
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

  function startGroupCall() {
    if (!isGroup) return;
    const peers = conversation.participants
      .filter((p) => p.id !== meId)
      .slice(0, 3); // mesh max 4 total
    if (peers.length === 0) return;
    setPreCallTarget({
      peerIds: peers.map((p) => p.id),
      peerInfos: peers.map((p) => ({ userId: p.id, name: p.name })),
    });
  }

  async function confirmCall(opts: PreCallOptions) {
    if (!preCallTarget) return;
    const target = preCallTarget;
    setPreCallTarget(null);
    await call.start(target.peerIds, target.peerInfos, opts);
  }

  // Compute a peer for the DM header avatar. The full participant lookup
  // lives in dmOther but that returns only id+name; we want the avatar URL
  // too for a richer header.
  const dmPeerFull = isGroup
    ? null
    : conversation.participants.find((p) => p.id !== meId) ?? null;

  // Real presence: online flag comes from the chat-namespace socket events
  // dispatched into the presence slice. No more hardcoded "Online" lies.
  const dmPeerOnline = useAppSelector((s) =>
    dmPeerFull ? Boolean(s.presence.online[dmPeerFull.id]) : false,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card/40 px-4 py-3">
        {isGroup ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <MembersSheet conversation={conversation} meId={meId} />
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar className="h-9 w-9">
                {dmPeerFull?.avatarUrl ? (
                  <AvatarImage src={dmPeerFull.avatarUrl} alt={dmPeerFull.name} />
                ) : null}
                <AvatarFallback className="text-xs font-semibold">
                  {initials(dmPeerFull?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              {/* Real presence dot: only renders when the peer's userId is
                  in the online set, sourced from chat-namespace presence
                  events. */}
              {dmPeerOnline && (
                <span
                  aria-label="Online"
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {headerName(conversation, meId)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {dmPeerOnline ? (
                  <>
                    <span className="text-emerald-400">●</span> Online · Direct message
                  </>
                ) : (
                  "Direct message"
                )}
              </div>
            </div>
          </div>
        )}
        {isGroup ? (
          conversation.participants.length > 1 && (
            <button
              type="button"
              onClick={startGroupCall}
              aria-label="Start group call"
              title="Start group call"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Phone className="h-4 w-4" />
            </button>
          )
        ) : (
          dmPeer && (
            <button
              type="button"
              onClick={() =>
                setPreCallTarget({
                  peerIds: [dmPeer.id],
                  peerInfos: [{ userId: dmPeer.id, name: dmPeer.name }],
                })
              }
              aria-label={`Call ${dmPeer.name}`}
              title={`Call ${dmPeer.name}`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Phone className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-1 overflow-y-auto bg-gradient-to-b from-background to-background/80 px-4 py-4"
      >
        {/* Top-of-thread "loading older" indicator. Renders only while the
            next page is in flight; once it resolves the post-fetch effect
            pins the scroll so this banner appearing/disappearing doesn't
            visually jump the conversation. */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary" />
              Loading older…
            </span>
          </div>
        )}
        {!hasMore && !isLoading && messages.length > 0 && (
          <div className="flex items-center justify-center py-2">
            <span className="rounded-full border border-border/40 bg-card/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Beginning of conversation
            </span>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="font-medium text-foreground">Say hi</div>
            <div className="mt-1 text-xs">
              No messages yet. Drop a line and start the conversation.
            </div>
          </div>
        ) : (
          ordered.map((m, idx) => {
            const mine = m.authorId === meId;
            const prev = ordered[idx - 1];
            const next = ordered[idx + 1];
            const isAuthorChange = !prev || prev.authorId !== m.authorId;
            const isAuthorChangeNext = !next || next.authorId !== m.authorId;
            const isDayChange =
              !prev || isoDayKey(prev.createdAt) !== isoDayKey(m.createdAt);
            // A message starts a "run" when the author changed OR the day
            // changed; ends a run when the next message has a different
            // author or day. Only the first run-message shows the author
            // label, only the last shows the timestamp — keeps long
            // back-and-forths visually quiet.
            const runStart = isAuthorChange || isDayChange;
            const runEnd =
              isAuthorChangeNext ||
              !next ||
              isoDayKey(next.createdAt) !== isoDayKey(m.createdAt);
            const showAuthor = isGroup && !mine && runStart;
            const showTimestamp = runEnd;

            return (
              <div key={m.id}>
                {isDayChange && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                      {fmtDateDivider(m.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex flex-col gap-0.5",
                    runStart && !isDayChange && "mt-2",
                  )}
                >
                  <MessageBubble
                    message={m}
                    mine={mine}
                    showAuthor={showAuthor}
                    runStart={runStart}
                    runEnd={runEnd}
                  />
                  {showTimestamp && (
                    <div
                      className={cn(
                        "px-1 text-[10px] text-muted-foreground",
                        mine ? "self-end" : "self-start",
                      )}
                    >
                      {fmtTime(m.createdAt)}
                      {mine && (
                        <span className="ml-1 text-primary/80" aria-hidden>
                          ✓✓
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2 border-t border-border bg-card/40 px-3 py-3 sm:px-4 sm:py-4"
          noValidate
        >
          {pendingFile && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2 text-xs shadow-sm">
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

          {/* Composer shell — attach + textarea + send all live inside one
              rounded surface so they read as a single input rather than
              three loose controls. The shell itself receives the focus
              ring on focus-within. */}
          <div className="flex items-end gap-1 rounded-2xl border border-border/70 bg-card pl-1 pr-1.5 py-1 shadow-sm transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
            {/* Three hidden inputs — one per type the WhatsApp-style menu
                exposes. Only one is visible/triggered at a time, but each
                has the right `accept` filter so the OS file dialog scopes
                to the matching media. */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={docInputRef}
              type="file"
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip"
              onChange={onPickFile}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickFile}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            {recording ? (
              // While recording, the composer collapses to a "stop / cancel"
              // affordance + live timer so the user has a clear way to commit
              // or discard the take. Submitting attaches it to the message.
              <div className="flex flex-1 items-center gap-2 px-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  aria-label="Cancel voice recording"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="flex h-6 w-6 items-center justify-center">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                </span>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {formatDuration(recordingSeconds)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Recording…
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={stopRecording}
                  aria-label="Stop and attach voice message"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach a file"
                  title="Attach a file"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Paperclip className="h-[18px] w-[18px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() => photoInputRef.current?.click()}
                  className="gap-3 py-2.5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/15 text-violet-400">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <span className="text-sm">Photo &amp; Video</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => cameraInputRef.current?.click()}
                  className="gap-3 py-2.5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500/15 text-rose-400">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <span className="text-sm">Camera</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => docInputRef.current?.click()}
                  className="gap-3 py-2.5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/15 text-blue-400">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="text-sm">Document</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
            {!recording && (
              <button
                type="button"
                onClick={startRecording}
                aria-label="Record voice message"
                title="Record voice message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Mic className="h-[18px] w-[18px]" />
              </button>
            )}
            {!recording && (
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem className="flex-1 space-y-0 self-center">
                  <FormControl>
                    <Textarea
                      rows={1}
                      maxLength={4000}
                      placeholder={
                        pendingFile
                          ? "Add a caption (optional)…"
                          : "Message…"
                      }
                      className="min-h-[36px] resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-sm leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...field}
                      // Compose RHF's internal ref with our local one so the
                      // auto-resize effect can read scrollHeight.
                      ref={(el) => {
                        field.ref(el);
                        textareaRef.current = el;
                      }}
                      onKeyDown={onKeyDown}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            )}
            {!recording && (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                canSend
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95"
                  : "bg-muted text-muted-foreground/50",
              )}
            >
              <Send
                className={cn(
                  "h-4 w-4 transition-transform",
                  canSend && !isSending && "translate-x-px",
                )}
              />
            </button>
            )}
          </div>
          {/* Subtle keyboard hint — only when nothing is typed yet so it
              doesn't draw the eye during active composition. */}
          {!pendingFile && draft.trim().length === 0 && (
            <div className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Enter to send · Shift + Enter for newline
            </div>
          )}
        </form>
      </Form>

      <PreCallDialog
        open={!!preCallTarget}
        onOpenChange={(o) => {
          if (!o) setPreCallTarget(null);
        }}
        peers={preCallTarget?.peerInfos ?? []}
        onConfirm={confirmCall}
      />
    </div>
  );
}
