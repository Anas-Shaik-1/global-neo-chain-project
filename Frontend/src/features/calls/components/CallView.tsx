import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCall } from "../CallProvider";
import { cn } from "@/lib/utils";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CallView() {
  const {
    state,
    peerInfo,
    localStream,
    remoteStream,
    controls,
    end,
    error,
  } = useCall();

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [secs, setSecs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (localRef.current) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (state !== "active") {
      startedAtRef.current = null;
      setSecs(0);
      return;
    }
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    const id = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      setSecs(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  if (state !== "outgoing-pending" && state !== "active") return null;

  const status =
    state === "outgoing-pending"
      ? "Calling..."
      : state === "active"
        ? formatDuration(secs)
        : "";

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-5 py-3 backdrop-blur">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-white/60">
            {state === "outgoing-pending" ? "Outgoing call" : "On call"}
          </span>
          <span className="font-display text-lg font-semibold">
            {peerInfo?.name ?? "Connecting"}
          </span>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">
          {status}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {remoteStream ? (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center text-white/60">
            <div>
              <div className="text-sm uppercase tracking-wider">
                Waiting for {peerInfo?.name ?? "peer"}…
              </div>
              {error && (
                <div className="mt-2 text-xs text-red-300">{error}</div>
              )}
            </div>
          </div>
        )}

        <div className="absolute right-4 top-4 h-32 w-44 overflow-hidden rounded-lg border border-white/20 bg-black/60 shadow-lg sm:h-40 sm:w-56">
          {localStream && !controls.cameraOff ? (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
              {controls.cameraOff ? "Camera off" : "—"}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-black/40 px-5 py-4 backdrop-blur">
        <button
          type="button"
          onClick={controls.toggleMute}
          aria-label={controls.muted ? "Unmute" : "Mute"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            controls.muted
              ? "bg-white text-black hover:bg-white/90"
              : "bg-white/10 text-white hover:bg-white/20",
          )}
        >
          {controls.muted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={controls.toggleCamera}
          aria-label={controls.cameraOff ? "Turn camera on" : "Turn camera off"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            controls.cameraOff
              ? "bg-white text-black hover:bg-white/90"
              : "bg-white/10 text-white hover:bg-white/20",
          )}
        >
          {controls.cameraOff ? (
            <VideoOff className="h-5 w-5" />
          ) : (
            <Video className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={end}
          aria-label="End call"
          className="flex h-12 w-16 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
