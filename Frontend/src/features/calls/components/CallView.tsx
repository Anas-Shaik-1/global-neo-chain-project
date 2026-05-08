import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Circle,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Square,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
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
    const el = ref.current;
    if (!el) return;
    el.srcObject = entry.stream;
    // Clear srcObject on unmount/stream-swap so the MediaStream isn't pinned
    // to a detached video element. Without this, ended group-call streams
    // hang around in memory until GC eventually picks them up.
    return () => {
      el.srcObject = null;
    };
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

  // Recording state: holds the active MediaRecorder + a buffer of chunks.
  // When the user stops recording, we assemble a webm Blob and trigger a
  // download. AudioContext is kept across the recording's lifetime so
  // local + remote audio stay properly mixed.
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const recStartedAtRef = useRef<number | null>(null);

  /** Returns the "primary" video to capture for screenshot/record. */
  const primaryRemoteStream = useCallback((): MediaStream | null => {
    if (remoteStream) return remoteStream;
    const first = Array.from(remoteStreams.values())[0];
    return first?.stream ?? null;
  }, [remoteStream, remoteStreams]);

  function takeScreenshot() {
    // Prefer the remote video (the other person/people) — that's what users
    // typically want to capture. Fall back to the local self-view if remote
    // hasn't arrived yet.
    const target =
      remoteRef.current && remoteRef.current.videoWidth > 0
        ? remoteRef.current
        : localRef.current;
    if (!target || target.videoWidth === 0) {
      toast.error("Video not ready yet — try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = target.videoWidth;
    canvas.height = target.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(target, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gnc-call-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Screenshot saved");
    }, "image/png");
  }

  function startRecording() {
    if (recording) return;
    const remote = primaryRemoteStream();
    if (!localStream && !remote) {
      toast.error("Nothing to record yet.");
      return;
    }

    // Build a combined stream:
    //   • video: prefer remote (the conversation), fall back to local
    //   • audio: mix local mic + any remote audio via AudioContext so both
    //     sides of the conversation land on the recorded track.
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();

    if (localStream && localStream.getAudioTracks().length > 0) {
      audioCtx.createMediaStreamSource(localStream).connect(dest);
    }
    if (remote && remote.getAudioTracks().length > 0) {
      audioCtx.createMediaStreamSource(remote).connect(dest);
    }
    for (const entry of remoteStreams.values()) {
      if (entry.stream === remote) continue;
      if (entry.stream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(entry.stream).connect(dest);
      }
    }

    const videoSource = remote ?? localStream;
    const combined = new MediaStream();
    if (videoSource) {
      for (const t of videoSource.getVideoTracks()) combined.addTrack(t);
    }
    for (const t of dest.stream.getAudioTracks()) combined.addTrack(t);

    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp8,opus" });
    } catch {
      try {
        mr = new MediaRecorder(combined);
      } catch {
        toast.error("Recording isn't supported in this browser.");
        audioCtx.close();
        audioCtxRef.current = null;
        return;
      }
    }

    recordedChunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gnc-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      recordedChunksRef.current = [];
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      toast.success("Recording saved");
    };

    mr.start(1000); // emit a chunk per second so we don't lose state on crash
    recorderRef.current = mr;
    recStartedAtRef.current = Date.now();
    setRecSecs(0);
    setRecording(true);
    toast.info("Recording started");
  }

  function stopRecording() {
    const mr = recorderRef.current;
    if (!mr) return;
    if (mr.state !== "inactive") mr.stop();
    recorderRef.current = null;
    recStartedAtRef.current = null;
    setRecording(false);
  }

  // Recording timer — drives the small "● 00:42" pill in the call header.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      if (recStartedAtRef.current === null) return;
      setRecSecs(Math.floor((Date.now() - recStartedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  // If the call ends mid-recording, force-stop so the user still gets the
  // partial file on disk.
  useEffect(() => {
    if (state === "active" || state === "outgoing-pending") return;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setRecording(false);
  }, [state]);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.srcObject = localStream;
    return () => {
      el.srcObject = null;
    };
  }, [localStream]);

  useEffect(() => {
    const el = remoteRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    return () => {
      el.srcObject = null;
    };
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
        <div className="flex items-center gap-2">
          {recording && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 font-mono text-xs text-red-300"
              title="Recording in progress"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              REC {formatDuration(recSecs)}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">
            {status}
          </span>
        </div>
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
          onClick={takeScreenshot}
          aria-label="Take screenshot"
          title="Take screenshot"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <Camera className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => (recording ? stopRecording() : startRecording())}
          aria-label={recording ? "Stop recording" : "Record meeting"}
          title={recording ? "Stop recording" : "Record meeting"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            recording
              ? "bg-red-500 text-white hover:bg-red-500/90"
              : "bg-white/10 text-white hover:bg-white/20",
          )}
        >
          {recording ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        <button
          type="button"
          onClick={end}
          aria-label="End call"
          className="ml-2 flex h-12 w-16 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
