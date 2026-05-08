import { useState } from "react";
import { Pencil, Trash2, X, Check, NotebookPen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useAddMeetingNote,
  useDeleteMeetingNote,
  useMeetingNotes,
  useUpdateMeetingNote,
  type MeetingNote,
} from "../api/hooks";

interface Props {
  eventId: string;
  /** True when the viewer is the event owner, an attendee, or admin. */
  canPost: boolean;
}

function initials(name: string | null): string {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(t).toLocaleDateString();
}

/**
 * Meeting-notes panel rendered inside the event detail dialog. Designed to
 * survive the meeting itself — the list shows every note ever attached to
 * the event, ordered oldest-first like minutes. Posting is gated on
 * attendee/owner status; reading is open to anyone with view access.
 */
export function MeetingNotes({ eventId, canPost }: Props) {
  const q = useMeetingNotes(eventId);
  const add = useAddMeetingNote(eventId);
  const [draft, setDraft] = useState("");

  async function onAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      await add.mutateAsync(trimmed);
      setDraft("");
    } catch {
      // toast already fires from the hook
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Meeting notes
        </span>
        {q.data && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {q.data.length} {q.data.length === 1 ? "note" : "notes"}
          </span>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : q.data && q.data.length > 0 ? (
        <ul className="space-y-2">
          {q.data.map((note) => (
            <NoteRow key={note.id} note={note} eventId={eventId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 bg-card/30 px-3 py-4 text-center text-xs text-muted-foreground">
          No notes yet.{" "}
          {canPost
            ? "Drop the first one below — it'll stay visible after the meeting."
            : "Attendees can take notes during the meeting; they'll show up here."}
        </p>
      )}

      {canPost && (
        <div className="space-y-2 rounded-md border border-border/60 bg-card/40 p-3">
          <Textarea
            rows={2}
            maxLength={5000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Action items, decisions, follow-ups…"
            className="min-h-[2.5rem]"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={onAdd}
              disabled={add.isPending || draft.trim().length === 0}
            >
              {add.isPending ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, eventId }: { note: MeetingNote; eventId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const update = useUpdateMeetingNote(eventId);
  const del = useDeleteMeetingNote(eventId);

  async function onSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === note.body) {
      setEditing(false);
      return;
    }
    try {
      await update.mutateAsync({ id: note.id, body: trimmed });
      setEditing(false);
    } catch {
      // hook toasts the error
    }
  }

  async function onDelete() {
    if (!confirm("Delete this note?")) return;
    try {
      await del.mutateAsync(note.id);
    } catch {
      // hook toasts the error
    }
  }

  const edited = note.updatedAt !== note.createdAt;

  return (
    <li className="flex gap-3 rounded-md border border-border/40 bg-card/30 p-3">
      <Avatar className="h-7 w-7 shrink-0">
        {note.authorAvatarUrl ? (
          <AvatarImage src={note.authorAvatarUrl} alt={note.authorName ?? ""} />
        ) : null}
        <AvatarFallback className="text-[10px] font-semibold">
          {initials(note.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {note.authorName ?? "Unknown"}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {relativeTime(note.createdAt)}
            {edited && (
              <span className="ml-1 text-muted-foreground/70">· edited</span>
            )}
          </span>
          {note.canManage && !editing && (
            <div className="ml-auto flex gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setEditing(true)}
                aria-label="Edit note"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:text-destructive"
                onClick={onDelete}
                disabled={del.isPending}
                aria-label="Delete note"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              rows={2}
              maxLength={5000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setDraft(note.body);
                  setEditing(false);
                }}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn("gap-1")}
                onClick={onSave}
                disabled={update.isPending || draft.trim().length === 0}
              >
                <Check className="h-3 w-3" />
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 whitespace-pre-line text-sm text-foreground/90">
            {note.body}
          </div>
        )}
      </div>
    </li>
  );
}
