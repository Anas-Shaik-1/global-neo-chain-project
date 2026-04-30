import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import SimplePeer from "simple-peer";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import {
  connectCallsSocket,
  disconnectCallsSocket,
  emitAccept,
  emitEnd,
  emitIceCandidate,
  emitInvite,
  emitReject,
  onCallAccepted,
  onCallEnded,
  onCallRejected,
  onIceCandidate,
  onIncomingCall,
  type IncomingCallPayload,
} from "./socket";
import { getApi } from "@/api/axios";
import type { CallSession } from "./api/hooks";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export type CallState =
  | "idle"
  | "outgoing-pending"
  | "incoming-ringing"
  | "active"
  | "ended";

export interface PeerInfo {
  userId: string;
  name: string;
}

export interface CallControls {
  muted: boolean;
  cameraOff: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
}

export interface CallContextValue {
  state: CallState;
  peerInfo: PeerInfo | null;
  callId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  controls: CallControls;
  error: string | null;
  screenSharing: boolean;
  start: (calleeId: string, calleeName: string) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => void;
  end: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}

interface PendingIncoming {
  callId: string;
  callerId: string;
  callerName: string;
  offer: unknown;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const me = useAppSelector((s) => s.auth.user);

  const [state, setState] = useState<CallState>("idle");
  const [peerInfo, setPeerInfo] = useState<PeerInfo | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);

  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerUserIdRef = useRef<string | null>(null);
  const pendingIncomingRef = useRef<PendingIncoming | null>(null);

  const stopLocalStream = useCallback(() => {
    const s = localStreamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
    }
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const cleanup = useCallback(() => {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }
    stopLocalStream();
    setRemoteStream(null);
    callIdRef.current = null;
    peerUserIdRef.current = null;
    pendingIncomingRef.current = null;
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
  }, [stopLocalStream]);

  const finishCall = useCallback(
    (next: CallState = "ended") => {
      cleanup();
      setState(next);
      setCallId(null);
      setPeerInfo(null);
      // Auto-clear error/ended state shortly after so UI returns to idle.
      window.setTimeout(() => {
        setState((s) => (s === "ended" ? "idle" : s));
      }, 1500);
    },
    [cleanup],
  );

  const persistEnd = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await getApi().post(`/calls/${id}/end`);
    } catch {
      // best-effort
    }
  }, []);

  // Connect socket whenever auth token is available.
  useEffect(() => {
    if (!token) return;
    connectCallsSocket(token);
    return () => {
      disconnectCallsSocket();
    };
  }, [token]);

  // Subscribe to incoming-call events globally.
  useEffect(() => {
    if (!token) return;
    const off = onIncomingCall((payload: IncomingCallPayload) => {
      // Ignore if already in a call.
      if (peerRef.current) return;
      pendingIncomingRef.current = {
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        offer: payload.offer,
      };
      setCallId(payload.callId);
      setPeerInfo({ userId: payload.callerId, name: payload.callerName });
      setState("incoming-ringing");
      setError(null);
    });
    return off;
  }, [token]);

  // Subscribe to ICE candidates from the peer.
  useEffect(() => {
    if (!token) return;
    const off = onIceCandidate(({ callId: incomingId, candidate }) => {
      if (!peerRef.current) return;
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      try {
        peerRef.current.signal(
          candidate as Parameters<SimplePeer.Instance["signal"]>[0],
        );
      } catch {
        // ignore stray candidates
      }
    });
    return off;
  }, [token]);

  // Subscribe to "answer" event for the caller.
  useEffect(() => {
    if (!token) return;
    const off = onCallAccepted(({ callId: incomingId, answer }) => {
      if (!peerRef.current) return;
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      try {
        peerRef.current.signal(
          answer as Parameters<SimplePeer.Instance["signal"]>[0],
        );
        setState("active");
      } catch {
        // ignore
      }
    });
    return off;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const off = onCallRejected(({ callId: incomingId }) => {
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      setError("Call was declined.");
      finishCall("ended");
    });
    return off;
  }, [token, finishCall]);

  useEffect(() => {
    if (!token) return;
    const off = onCallEnded(({ callId: incomingId }) => {
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      finishCall("ended");
    });
    return off;
  }, [token, finishCall]);

  const start = useCallback(
    async (calleeId: string, calleeName: string) => {
      if (!me) {
        setError("Not signed in");
        return;
      }
      if (peerRef.current) return;
      setError(null);
      setState("outgoing-pending");
      setPeerInfo({ userId: calleeId, name: calleeName });

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch {
        setError("Allow camera and mic to start a call.");
        setState("idle");
        setPeerInfo(null);
        return;
      }

      // Persist call session via REST.
      let session: CallSession;
      try {
        const res = await getApi().post("/calls", { calleeId });
        session = res.data as CallSession;
      } catch {
        for (const t of stream.getTracks()) t.stop();
        setError("Failed to start call.");
        setState("idle");
        setPeerInfo(null);
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      callIdRef.current = session.id;
      peerUserIdRef.current = calleeId;
      setCallId(session.id);

      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        stream,
        config: { iceServers: ICE_SERVERS },
      });
      peerRef.current = peer;

      peer.on("signal", (data: SimplePeer.SignalData) => {
        if (
          (data as RTCSessionDescriptionInit).type === "offer" &&
          (data as RTCSessionDescriptionInit).sdp
        ) {
          emitInvite({
            callId: session.id,
            calleeId,
            offer: data,
          });
        } else {
          emitIceCandidate({
            callId: session.id,
            peerUserId: calleeId,
            candidate: data,
          });
        }
      });

      peer.on("stream", (rs: MediaStream) => {
        setRemoteStream(rs);
        setState("active");
      });

      peer.on("close", () => {
        const id = callIdRef.current;
        const peerId = peerUserIdRef.current;
        if (id && peerId) {
          emitEnd({ callId: id, peerUserId: peerId });
        }
        void persistEnd(id);
        finishCall("ended");
      });

      peer.on("error", () => {
        const id = callIdRef.current;
        const peerId = peerUserIdRef.current;
        if (id && peerId) {
          emitEnd({ callId: id, peerUserId: peerId });
        }
        void persistEnd(id);
        setError("Connection error.");
        finishCall("ended");
      });
    },
    [me, finishCall, persistEnd],
  );

  const accept = useCallback(async () => {
    const pending = pendingIncomingRef.current;
    if (!pending) return;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch {
      setError("Allow camera and mic to accept the call.");
      // Decline implicitly.
      emitReject({ callId: pending.callId, callerId: pending.callerId });
      pendingIncomingRef.current = null;
      finishCall("ended");
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    callIdRef.current = pending.callId;
    peerUserIdRef.current = pending.callerId;

    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      stream,
      config: { iceServers: ICE_SERVERS },
    });
    peerRef.current = peer;

    peer.on("signal", (data: SimplePeer.SignalData) => {
      if (
        (data as RTCSessionDescriptionInit).type === "answer" &&
        (data as RTCSessionDescriptionInit).sdp
      ) {
        emitAccept({
          callId: pending.callId,
          callerId: pending.callerId,
          answer: data,
        });
      } else {
        emitIceCandidate({
          callId: pending.callId,
          peerUserId: pending.callerId,
          candidate: data,
        });
      }
    });

    peer.on("stream", (rs: MediaStream) => {
      setRemoteStream(rs);
      setState("active");
    });

    peer.on("close", () => {
      const id = callIdRef.current;
      const peerId = peerUserIdRef.current;
      if (id && peerId) {
        emitEnd({ callId: id, peerUserId: peerId });
      }
      void persistEnd(id);
      finishCall("ended");
    });

    peer.on("error", () => {
      const id = callIdRef.current;
      const peerId = peerUserIdRef.current;
      if (id && peerId) {
        emitEnd({ callId: id, peerUserId: peerId });
      }
      void persistEnd(id);
      setError("Connection error.");
      finishCall("ended");
    });

    // Feed the incoming offer.
    try {
      peer.signal(
        pending.offer as Parameters<SimplePeer.Instance["signal"]>[0],
      );
    } catch {
      setError("Failed to accept call.");
      finishCall("ended");
      return;
    }
    pendingIncomingRef.current = null;
    setState("active");
  }, [finishCall, persistEnd]);

  const reject = useCallback(() => {
    const pending = pendingIncomingRef.current;
    if (pending) {
      emitReject({ callId: pending.callId, callerId: pending.callerId });
      pendingIncomingRef.current = null;
    }
    finishCall("ended");
  }, [finishCall]);

  const end = useCallback(() => {
    const id = callIdRef.current;
    const peerId = peerUserIdRef.current;
    if (id && peerId) {
      emitEnd({ callId: id, peerUserId: peerId });
    }
    void persistEnd(id);
    finishCall("ended");
  }, [finishCall, persistEnd]);

  const toggleMute = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    setMuted((cur) => {
      const next = !cur;
      for (const t of s.getAudioTracks()) t.enabled = !next;
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    setCameraOff((cur) => {
      const next = !cur;
      for (const t of s.getVideoTracks()) t.enabled = !next;
      return next;
    });
  }, []);

  // stopScreenShare is referenced by the screenTrack.onended callback that's
  // assigned inside startScreenShare; keep the latest reference in a ref so
  // the callback always points at the current closure. Declared up front so
  // startScreenShare can capture it lexically.
  const stopScreenShareRef = useRef<(() => Promise<void>) | null>(null);

  // Screen share uses navigator.mediaDevices.getDisplayMedia which is supported
  // on Chrome/Edge/Firefox/Safari (modern) over HTTPS or on localhost.
  // We swap the outgoing video track via RTCRtpSender.replaceTrack so the peer
  // sees the screen feed transparently without renegotiation.
  const startScreenShare = useCallback(async (): Promise<void> => {
    const peer = peerRef.current;
    if (!peer) return;
    if (screenSharing) return;
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
        audio: false,
      });
    } catch {
      toast.error("Could not start screen share");
      return;
    }
    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) {
      for (const t of screenStream.getTracks()) t.stop();
      return;
    }
    const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
    const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      try {
        await sender.replaceTrack(screenTrack);
      } catch {
        toast.error("Could not start screen share");
        for (const t of screenStream.getTracks()) t.stop();
        return;
      }
    }

    // Preserve existing audio tracks (mic) when previewing the screen locally.
    const existingAudio = localStreamRef.current?.getAudioTracks() ?? [];
    const previewStream = new MediaStream([screenTrack, ...existingAudio]);
    // Stop only the *old video* tracks; keep audio alive for the call.
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getVideoTracks()) t.stop();
    }
    localStreamRef.current = previewStream;
    setLocalStream(previewStream);
    setScreenSharing(true);

    // Auto-revert when the user clicks the browser-provided "Stop sharing".
    screenTrack.onended = () => {
      void stopScreenShareRef.current?.();
    };
  }, [screenSharing]);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    const peer = peerRef.current;
    if (!peer) {
      setScreenSharing(false);
      return;
    }
    let cameraStream: MediaStream;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch {
      toast.error("Could not re-enable camera");
      // Best-effort: still mark as not sharing so the UI returns to normal.
      setScreenSharing(false);
      return;
    }
    const cameraVideoTrack = cameraStream.getVideoTracks()[0];
    if (cameraVideoTrack) {
      const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
      const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(cameraVideoTrack);
        } catch {
          // ignore — we still want to swap the local preview back
        }
      }
    }
    // Stop the previous (screen) stream tracks before replacing.
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
    }
    localStreamRef.current = cameraStream;
    setLocalStream(cameraStream);
    // If the user had toggled mute/camera-off prior to sharing, reset those
    // affordances since this is a fresh stream.
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
  }, []);

  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      peerInfo,
      callId,
      localStream,
      remoteStream,
      controls: { muted, cameraOff, toggleMute, toggleCamera },
      error,
      screenSharing,
      start,
      accept,
      reject,
      end,
      startScreenShare,
      stopScreenShare,
    }),
    [
      state,
      peerInfo,
      callId,
      localStream,
      remoteStream,
      muted,
      cameraOff,
      toggleMute,
      toggleCamera,
      error,
      screenSharing,
      start,
      accept,
      reject,
      end,
      startScreenShare,
      stopScreenShare,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
