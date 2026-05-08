import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Phone,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PreCallOptions {
  /** Capture microphone audio. */
  audio: boolean;
  /** Capture camera video. */
  video: boolean;
  /** Start the call already screen-sharing instead of showing the camera. */
  screenShare: boolean;
}

interface Peer {
  userId: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display-only — used to render "Calling …" header copy. */
  peers: Peer[];
  /** Fired when the user confirms; receives chosen mic/cam/screen toggles. */
  onConfirm: (opts: PreCallOptions) => Promise<void> | void;
}

/**
 * Confirmation dialog shown before any outgoing call. Lets the user pick
 * which media to attach (mic / camera / screen share) before the actual
 * `getUserMedia` prompt fires — same pattern as Google Meet / Zoom's
 * pre-call lobby.
 */
export function PreCallDialog({ open, onOpenChange, peers, onConfirm }: Props) {
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);
  const [screenShare, setScreenShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const headline =
    peers.length === 0
      ? "Start call"
      : peers.length === 1
        ? `Call ${peers[0]!.name}`
        : `Group call · ${peers.length + 1} participants`;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm({ audio, video, screenShare });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {peers.length > 1 ? (
              <Users className="h-5 w-5 text-primary" />
            ) : (
              <Phone className="h-5 w-5 text-primary" />
            )}
            {headline}
          </DialogTitle>
          <DialogDescription>
            Pick what you want to share before connecting. You can change these
            during the call.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          <Toggle
            on={audio}
            onChange={setAudio}
            OnIcon={Mic}
            OffIcon={MicOff}
            label="Microphone"
          />
          <Toggle
            on={video}
            onChange={setVideo}
            OnIcon={Video}
            OffIcon={VideoOff}
            label="Camera"
            disabled={screenShare}
          />
          <Toggle
            on={screenShare}
            onChange={(v) => {
              setScreenShare(v);
              if (v) setVideo(false);
            }}
            OnIcon={Monitor}
            OffIcon={Monitor}
            label="Screen"
          />
        </div>

        {screenShare && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            Screen share will replace your camera at the start of the call.
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || (!audio && !video && !screenShare)}
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            {submitting ? "Connecting…" : "Start call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  on,
  onChange,
  OnIcon,
  OffIcon,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  OnIcon: React.ComponentType<{ className?: string }>;
  OffIcon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary",
        disabled && "cursor-not-allowed opacity-50",
        on
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-wider",
          on ? "text-primary/80" : "text-muted-foreground/70",
        )}
      >
        {on ? "On" : "Off"}
      </span>
    </button>
  );
}
