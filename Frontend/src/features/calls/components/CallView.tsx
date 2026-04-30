import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useCall, type RemoteStreamEntry } from "../CallProvider";
import { cn } from "@/lib/utils";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface RemoteVideoTileProps {
  entry: RemoteStreamEntry;
}

function RemoteVideoTile({ entry }: RemoteVideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = entry.stream;
  }, [entry.stream]);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {entry.name}
      </div>
    </div>
  );
}

export function CallView() {
  const {
    state,
    peerInfo,
    peers,
    kind,
    localStream,
    remoteStream,
    remoteStreams,
    controls,
    end,
    error,
    screenSharing,
    startScreenShare,
    stopScreenShare,
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

  const isGroup = kind === "GROUP";
  const status =
    state === "outgoing-pending"
      ? "Calling..."
      : state === "active"
        ? formatDuration(secs)
        : "";

  const headerName = isGroup
    ? `Group call · ${peers.length + 1} participants`
    : peerInfo?.name ?? "Connecting";

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-5 py-3 backdrop-blur">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-white/60">
            {state === "outgoing-pending"
              ? isGroup
                ? "Outgoing group call"
                : "Outgoing call"
              : isGroup
                ? "Group call"
                : "On call"}
          </span>
          <span className="font-display text-lg font-semibold">{headerName}</span>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">
          {status}
        </span>
      </div>

      {screenSharing && (
        <div className="flex items-center justify-center gap-3 border-b border-white/10 bg-emerald-600/20 px-5 py-2 text-xs text-emerald-100">
          <Monitor className="h-3.5 w-3.5" />
          <span>You are sharing your screen</span>
          <button
            type="button"
            onClick={() => {
              void stopScreenShare();
            }}
            className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-white/20"
          >
            Stop
          </button>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {isGroup ? (
          <div
            className={cn(
              "grid h-full gap-2 p-3",
              remoteStreams.size === 0
                ? "grid-cols-1"
                : remoteStreams.size === 1
                  ? "grid-cols-1"
                  : "grid-cols-2",
            )}
          >
            {remoteStreams.size === 0 ? (
              <div className="flex items-center justify-center text-center text-white/60">
                <div>
                  <div className="text-sm uppercase tracking-wider">
                    Waiting for participants…
                  </div>
                  {error && (
                    <div className="mt-2 text-xs text-red-300">{error}</div>
                  )}
                </div>
              </div>
            ) : (
              Array.from(remoteStreams.values()).map((entry) => (
                <RemoteVideoTile key={entry.userId} entry={entry} />
              ))
            )}
            <div className="absolute bottom-20 right-4 h-32 w-44 overflow-hidden rounded-lg border border-white/20 bg-black/60 shadow-lg sm:h-40 sm:w-56">
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
              <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                You
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
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
          onClick={() => {
            if (screenSharing) {
              void stopScreenShare();
            } else {
              void startScreenShare();
            }
          }}
          aria-label={screenSharing ? "Stop sharing screen" : "Share screen"}
          title={screenSharing ? "Stop sharing screen" : "Share screen"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            screenSharing
              ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
              : "bg-white/10 text-white hover:bg-white/20",
          )}
        >
          {screenSharing ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
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
