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
  emitAcceptMulti,
  emitEnd,
  emitEndMulti,
  emitIceCandidate,
  emitInvite,
  emitInviteMulti,
  emitPeerSignal,
  emitReject,
  onCallAccepted,
  onCallEnded,
  onCallRejected,
  onIceCandidate,
  onIncomingCall,
  onPeerAccepted,
  onPeerLeft,
  onPeerSignal,
  type IncomingCallPayload,
} from "./socket";
import { getApi } from "@/api/axios";
import type { CallKind, CallSession } from "./api/hooks";

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

export interface RemoteStreamEntry {
  userId: string;
  name: string;
  stream: MediaStream;
}

export interface CallContextValue {
  state: CallState;
  /** For DIRECT calls, the single peer; for GROUP calls, the first non-self peer. */
  peerInfo: PeerInfo | null;
  /** All peers in the call (excluding self). */
  peers: PeerInfo[];
  kind: CallKind;
  callId: string | null;
  localStream: MediaStream | null;
  /** Legacy DIRECT-only single remote stream. */
  remoteStream: MediaStream | null;
  /** All remote streams keyed by peer user id. */
  remoteStreams: Map<string, RemoteStreamEntry>;
  controls: CallControls;
  error: string | null;
  screenSharing: boolean;
  start: (
    peerIds: string[],
    peerInfos: PeerInfo[],
    /**
     * Pre-call media choices from the confirmation dialog. Defaults to
     * `{ audio: true, video: true, screenShare: false }` for callers that
     * haven't been migrated yet (the legacy "always with cam+mic" behavior).
     */
    options?: { audio?: boolean; video?: boolean; screenShare?: boolean },
  ) => Promise<void>;
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
  kind: CallKind;
  /** All participants of the call as advertised by the server. */
  peerIds: string[];
  signal: unknown;
  /**
   * Whether the caller initiated a video call. Defaults to true when the
   * server doesn't advertise the modality so we preserve existing behavior.
   */
  // TODO: have the backend stamp `video: boolean` on call:incoming so we can
  // honor audio-only invites end-to-end.
  video?: boolean;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const me = useAppSelector((s) => s.auth.user);

  const [state, setState] = useState<CallState>("idle");
  const [peerInfo, setPeerInfo] = useState<PeerInfo | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [kind, setKind] = useState<CallKind>("DIRECT");
  const [callId, setCallId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Map<string, RemoteStreamEntry>
  >(new Map());
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);

  // Multi-peer state. For DIRECT calls there's exactly one entry.
  const peersByIdRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const kindRef = useRef<CallKind>("DIRECT");
  const pendingIncomingRef = useRef<PendingIncoming | null>(null);
  // Set the moment a start()/accept() begins acquiring media, cleared once the
  // peer connections are wired up (or on failure). Guards against a double-tap
  // racing two getUserMedia calls and leaking the first MediaStream.
  const startingRef = useRef(false);
  // Tracks the access token the calls socket is currently connected with, so
  // that incidental token-string updates (e.g. silent refresh) don't cause us
  // to tear down and rebuild the socket — and lose any active call with it.
  const prevConnectedTokenRef = useRef<string | null>(null);
  // Pending finishCall timeout id. Stored in a ref so a follow-up call can
  // clear a stale timer instead of leaking it past unmount or queueing
  // multiple parallel resets.
  const finishTimeoutRef = useRef<number | null>(null);

  const stopLocalStream = useCallback(() => {
    const s = localStreamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
    }
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const cleanup = useCallback(() => {
    for (const peer of peersByIdRef.current.values()) {
      try {
        peer.destroy();
      } catch {
        // ignore
      }
    }
    peersByIdRef.current.clear();
    peerNamesRef.current.clear();
    stopLocalStream();
    setRemoteStreams(new Map());
    callIdRef.current = null;
    pendingIncomingRef.current = null;
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
    setPeers([]);
  }, [stopLocalStream]);

  const finishCall = useCallback(
    (next: CallState = "ended") => {
      cleanup();
      setState(next);
      setCallId(null);
      setPeerInfo(null);
      setKind("DIRECT");
      kindRef.current = "DIRECT";
      // Cancel any prior idle-reset timer so back-to-back finishCall() calls
      // don't queue duplicate timeouts and so unmount can clear it cleanly.
      if (finishTimeoutRef.current !== null) {
        window.clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
      // Auto-clear error/ended state shortly after so UI returns to idle.
      finishTimeoutRef.current = window.setTimeout(() => {
        finishTimeoutRef.current = null;
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

  const upsertRemoteStream = useCallback(
    (userId: string, stream: MediaStream) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(userId, {
          userId,
          name: peerNamesRef.current.get(userId) ?? "Unknown",
          stream,
        });
        return next;
      });
    },
    [],
  );

  const removeRemoteStream = useCallback((userId: string) => {
    setRemoteStreams((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  // Connect socket whenever auth token is available.
  //
  // We deliberately treat presence-of-token, not the token string itself, as
  // the connection trigger. A silent token refresh during an active call
  // would otherwise tear the socket down (and any active call with it).
  // Strategy: if we already have a live connection from a prior token and
  // the new token is also truthy, do nothing. Only spin up a new socket on
  // the truthy→from-nothing transition; only tear down on the truthy→null
  // transition (logout / session expiry).
  useEffect(() => {
    if (!token) {
      // Logout / session expiry: tear down whatever we had.
      if (prevConnectedTokenRef.current) {
        disconnectCallsSocket();
        prevConnectedTokenRef.current = null;
      }
      return;
    }
    if (prevConnectedTokenRef.current) {
      // Already connected from a prior token; don't recycle on token rotation.
      return;
    }
    connectCallsSocket(token);
    prevConnectedTokenRef.current = token;
    return () => {
      // This cleanup runs on unmount or when the next render's effect tears
      // us down. The truthy→null path above is the only one we want to act
      // on; actual logout path handles disconnect there.
      // Leaving an explicit no-op so the dep array stays simple — disconnect
      // happens in the truthy→null branch, not here.
    };
  }, [token]);

  // Cancel any pending finishCall idle-reset timer when the provider unmounts.
  useEffect(() => {
    return () => {
      if (finishTimeoutRef.current !== null) {
        window.clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
    };
  }, []);

  // Subscribe to incoming-call events globally.
  useEffect(() => {
    if (!token) return;
    const off = onIncomingCall((payload: IncomingCallPayload) => {
      // Ignore if already in a call.
      if (peersByIdRef.current.size > 0) return;
      const incomingKind = payload.kind ?? "DIRECT";
      const allPeerIds = Array.isArray(payload.peerIds) ? payload.peerIds : [];
      // Snapshot the modality if the server provided one. The current
      // IncomingCallPayload type doesn't declare `video` yet, so we read it
      // via a defensive cast and fall back to undefined (which means the
      // accept path defaults to video=true to preserve legacy behavior).
      const advertisedVideo = (payload as unknown as { video?: boolean }).video;
      pendingIncomingRef.current = {
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        kind: incomingKind,
        peerIds: allPeerIds,
        signal: payload.signal ?? payload.offer,
        video: advertisedVideo,
      };
      // Track caller name for display.
      peerNamesRef.current.set(payload.callerId, payload.callerName);
      setCallId(payload.callId);
      setKind(incomingKind);
      kindRef.current = incomingKind;
      setPeerInfo({ userId: payload.callerId, name: payload.callerName });
      setPeers([{ userId: payload.callerId, name: payload.callerName }]);
      setState("incoming-ringing");
      setError(null);
    });
    return off;
  }, [token]);

  // Helper: build a SimplePeer for a given peer userId. Wires up signal/stream/close handlers.
  //
  // `useInviteForOffer` controls how the FIRST GROUP offer is routed: the
  // call's original initiator uses `emitInviteMulti` (which the server fans
  // out via call:incoming so the receiver sees a ringing UI). Mid-call
  // mesh-expansion peers (created in response to `onPeerAccepted` /
  // `onPeerSignal` for an already-accepted call) MUST use `emitPeerSignal` —
  // the server rejects `call:invite-multi` from non-initiators, so otherwise
  // their offers would be silently dropped and the late mesh would never
  // form.
  const createPeer = useCallback(
    (
      peerUserId: string,
      isInitiator: boolean,
      stream: MediaStream,
      useInviteForOffer = false,
    ): SimplePeer.Instance => {
      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        stream,
        config: { iceServers: ICE_SERVERS },
      });
      peersByIdRef.current.set(peerUserId, peer);

      peer.on("signal", (data: SimplePeer.SignalData) => {
        const id = callIdRef.current;
        if (!id) return;
        if (kindRef.current === "DIRECT") {
          if (
            (data as RTCSessionDescriptionInit).type === "offer" &&
            (data as RTCSessionDescriptionInit).sdp
          ) {
            emitInvite({ callId: id, calleeId: peerUserId, offer: data });
          } else if (
            (data as RTCSessionDescriptionInit).type === "answer" &&
            (data as RTCSessionDescriptionInit).sdp
          ) {
            emitAccept({
              callId: id,
              callerId: peerUserId,
              answer: data,
            });
          } else {
            emitIceCandidate({
              callId: id,
              peerUserId,
              candidate: data,
            });
          }
          return;
        }
        // GROUP calls: route based on whether this peer's offer should ring
        // the receiver (only the original call initiator's first round) vs.
        // be plumbed through the mid-call mesh channel.
        const isOffer =
          (data as RTCSessionDescriptionInit).type === "offer" &&
          !!(data as RTCSessionDescriptionInit).sdp;
        if (isOffer && useInviteForOffer) {
          emitInviteMulti({
            callId: id,
            peerId: peerUserId,
            peerIds: [
              ...peerNamesRef.current.keys(),
              me?.id ?? "",
            ].filter(Boolean),
            signal: data,
            kind: "GROUP",
          });
        } else {
          emitPeerSignal({ callId: id, peerUserId, signal: data });
        }
      });

      peer.on("stream", (rs: MediaStream) => {
        upsertRemoteStream(peerUserId, rs);
        setState("active");
      });

      peer.on("close", () => {
        peersByIdRef.current.delete(peerUserId);
        removeRemoteStream(peerUserId);
        // If no peers remain, end the whole call.
        if (peersByIdRef.current.size === 0) {
          const id = callIdRef.current;
          void persistEnd(id);
          finishCall("ended");
        }
      });

      peer.on("error", () => {
        // Tear the SimplePeer instance down before dropping our reference —
        // otherwise its underlying RTCPeerConnection, ICE agents, and DTLS
        // state hang around in memory until GC eventually picks them up.
        try {
          peer.destroy();
        } catch {
          // ignore
        }
        peersByIdRef.current.delete(peerUserId);
        removeRemoteStream(peerUserId);
        if (peersByIdRef.current.size === 0) {
          const id = callIdRef.current;
          void persistEnd(id);
          setError("Connection error.");
          finishCall("ended");
        }
      });

      return peer;
    },
    [me?.id, finishCall, persistEnd, removeRemoteStream, upsertRemoteStream],
  );

  // Subscribe to legacy 1-1 ICE candidates.
  useEffect(() => {
    if (!token) return;
    const off = onIceCandidate(({ callId: incomingId, candidate }) => {
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      // Route to the only peer (DIRECT).
      const onlyPeer = peersByIdRef.current.values().next().value as
        | SimplePeer.Instance
        | undefined;
      if (!onlyPeer) return;
      try {
        onlyPeer.signal(
          candidate as Parameters<SimplePeer.Instance["signal"]>[0],
        );
      } catch {
        // ignore stray candidates
      }
    });
    return off;
  }, [token]);

  // Subscribe to legacy 1-1 "call:accepted" (answer) for the caller.
  useEffect(() => {
    if (!token) return;
    const off = onCallAccepted(({ callId: incomingId, answer }) => {
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      const onlyPeer = peersByIdRef.current.values().next().value as
        | SimplePeer.Instance
        | undefined;
      if (!onlyPeer) return;
      try {
        onlyPeer.signal(
          answer as Parameters<SimplePeer.Instance["signal"]>[0],
        );
        setState("active");
      } catch {
        // ignore
      }
    });
    return off;
  }, [token]);

  // Subscribe to multi-peer signals. Auto-create a non-initiator peer for an
  // unknown sender — this is how a late joiner receives offers from existing
  // members of a GROUP call (and, symmetrically, how existing members accept
  // a new joiner's offer).
  useEffect(() => {
    if (!token) return;
    const off = onPeerSignal(({ callId: incomingId, fromUserId, signal }) => {
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      let peer = peersByIdRef.current.get(fromUserId);
      if (!peer) {
        if (kindRef.current !== "GROUP") return;
        const stream = localStreamRef.current;
        if (!stream) return;
        peer = createPeer(fromUserId, false, stream);
      }
      try {
        peer.signal(signal as Parameters<SimplePeer.Instance["signal"]>[0]);
      } catch {
        // ignore
      }
    });
    return off;
  }, [token, createPeer]);

  // Late joiner mesh completion: when another peer accepts a GROUP call, we
  // may need a connection to them. Glare avoidance — only the participant
  // with the lexicographically smaller userId initiates; the other side
  // creates a non-initiator peer when the offer arrives via onPeerSignal.
  useEffect(() => {
    if (!token) return;
    const off = onPeerAccepted(({ callId: incomingId, userId: acceptedUserId }) => {
      if (callIdRef.current && callIdRef.current !== incomingId) return;
      if (!me) return;
      if (acceptedUserId === me.id) return;
      if (peersByIdRef.current.has(acceptedUserId)) return;
      if (kindRef.current !== "GROUP") return;
      const stream = localStreamRef.current;
      if (!stream) return;
      if (me.id < acceptedUserId) {
        createPeer(acceptedUserId, true, stream);
      }
    });
    return off;
  }, [token, me, createPeer]);

  useEffect(() => {
    if (!token) return;
    const off = onPeerLeft(({ userId }) => {
      const peer = peersByIdRef.current.get(userId);
      if (peer) {
        try {
          peer.destroy();
        } catch {
          // ignore
        }
      }
      peersByIdRef.current.delete(userId);
      removeRemoteStream(userId);
      if (peersByIdRef.current.size === 0) {
        const id = callIdRef.current;
        void persistEnd(id);
        finishCall("ended");
      }
    });
    return off;
  }, [token, removeRemoteStream, finishCall, persistEnd]);

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
    async (
      peerIds: string[],
      peerInfos: PeerInfo[],
      options?: { audio?: boolean; video?: boolean; screenShare?: boolean },
    ) => {
      if (!me) {
        setError("Not signed in");
        return;
      }
      if (peersByIdRef.current.size > 0) return;
      if (startingRef.current) return;
      if (peerIds.length === 0) return;
      if (peerIds.length > 3) {
        setError("Group calls support up to 4 participants.");
        return;
      }
      startingRef.current = true;
      setError(null);
      const isGroup = peerIds.length > 1;
      const callKind: CallKind = isGroup ? "GROUP" : "DIRECT";
      kindRef.current = callKind;
      setKind(callKind);
      setState("outgoing-pending");
      setPeers(peerInfos);
      setPeerInfo(peerInfos[0] ?? null);
      // Pre-populate names for any later display.
      for (const p of peerInfos) peerNamesRef.current.set(p.userId, p.name);

      // Resolve pre-call media choices. Default keeps legacy behavior
      // (cam + mic, no screen share) for any caller that hasn't been
      // migrated through the new PreCallDialog yet.
      const wantAudio = options?.audio ?? true;
      const wantVideo = options?.video ?? true;
      const wantScreenShare = options?.screenShare ?? false;

      let stream: MediaStream;
      try {
        if (wantScreenShare) {
          // Screen share replaces camera at the start; we still capture mic
          // separately so the user can talk over the share. Camera off.
          const display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
          if (wantAudio) {
            try {
              const micStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
              });
              for (const t of micStream.getAudioTracks()) display.addTrack(t);
            } catch {
              // Mic refusal is non-fatal — proceed with screen-only.
            }
          }
          stream = display;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: wantVideo,
            audio: wantAudio,
          });
        }
      } catch {
        setError(
          wantScreenShare
            ? "Allow screen sharing to start the call."
            : "Allow camera and mic to start a call.",
        );
        setState("idle");
        setPeerInfo(null);
        setPeers([]);
        startingRef.current = false;
        return;
      }

      // Persist call session via REST.
      let session: CallSession;
      try {
        const res = await getApi().post("/calls", { peerIds });
        session = res.data as CallSession;
      } catch {
        for (const t of stream.getTracks()) t.stop();
        setError("Failed to start call.");
        setState("idle");
        setPeerInfo(null);
        setPeers([]);
        startingRef.current = false;
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      callIdRef.current = session.id;
      setCallId(session.id);

      // Create one peer connection per remote peer (mesh). We are the call's
      // original initiator, so route first offers via call:invite-multi so
      // each peer's UI rings.
      for (const peerId of peerIds) {
        createPeer(peerId, true, stream, /* useInviteForOffer */ true);
      }
      startingRef.current = false;
    },
    [me, createPeer],
  );

  const accept = useCallback(async () => {
    const pending = pendingIncomingRef.current;
    if (!pending) return;
    // Same busy-flag pattern as start() — a double-tap on the accept button
    // can race two getUserMedia calls and leak the first MediaStream.
    if (startingRef.current) return;
    startingRef.current = true;
    setError(null);

    // Honor the invite's modality when the server advertised one. Default to
    // video=true to preserve legacy behavior for older payloads.
    // TODO: drop this fallback once the backend always stamps `video` on
    // call:incoming.
    const wantVideo = pending.video ?? true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: wantVideo,
        audio: true,
      });
    } catch {
      setError(
        wantVideo
          ? "Allow camera and mic to accept the call."
          : "Allow microphone access to accept the call.",
      );
      // Decline implicitly.
      emitReject({ callId: pending.callId, callerId: pending.callerId });
      pendingIncomingRef.current = null;
      startingRef.current = false;
      finishCall("ended");
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    callIdRef.current = pending.callId;
    kindRef.current = pending.kind;
    setKind(pending.kind);

    // Build a peer for the caller (non-initiator). The caller's offer is in
    // pending.signal and is fed below.
    const callerPeer = createPeer(pending.callerId, false, stream);

    if (pending.kind === "GROUP") {
      // Notify everyone we accepted — server fans out to all other participants.
      emitAcceptMulti({ callId: pending.callId });

      // For mesh: we'll see each other participant's offer arrive via
      // call:peer-signal. To ensure offers actually arrive, we proactively
      // create non-initiator peers for the OTHER participants (excluding self
      // and the caller we already created). They'll send their offers when
      // they too accept (or are already connected). We let them be the
      // initiators since they'll see the call:peer-accepted event.
      // — For simplicity we just create the caller peer here. Other
      // participants form their connections lazily when their signals arrive.
    }

    // Feed the caller's offer to the peer.
    try {
      callerPeer.signal(
        pending.signal as Parameters<SimplePeer.Instance["signal"]>[0],
      );
    } catch {
      setError("Failed to accept call.");
      startingRef.current = false;
      finishCall("ended");
      return;
    }
    pendingIncomingRef.current = null;
    setState("active");
    startingRef.current = false;
  }, [createPeer, finishCall]);

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
    if (id) {
      if (kindRef.current === "GROUP") {
        emitEndMulti({ callId: id });
      } else {
        // Notify the only peer, if we have one.
        const onlyPeerId = peersByIdRef.current.keys().next().value as
          | string
          | undefined;
        if (onlyPeerId) {
          emitEnd({ callId: id, peerUserId: onlyPeerId });
        }
      }
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
  // the callback always points at the current closure.
  const stopScreenShareRef = useRef<(() => Promise<void>) | null>(null);

  const startScreenShare = useCallback(async (): Promise<void> => {
    if (peersByIdRef.current.size === 0) return;
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
    // Replace the outgoing video track on every peer connection.
    for (const peer of peersByIdRef.current.values()) {
      const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
      const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(screenTrack);
        } catch {
          // continue best-effort across peers
        }
      }
    }

    // Preserve existing audio tracks (mic) when previewing the screen locally.
    const existingAudio = localStreamRef.current?.getAudioTracks() ?? [];
    const previewStream = new MediaStream([screenTrack, ...existingAudio]);
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getVideoTracks()) t.stop();
    }
    localStreamRef.current = previewStream;
    setLocalStream(previewStream);
    setScreenSharing(true);

    screenTrack.onended = () => {
      void stopScreenShareRef.current?.();
    };
  }, [screenSharing]);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    if (peersByIdRef.current.size === 0) {
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
      setScreenSharing(false);
      return;
    }
    const cameraVideoTrack = cameraStream.getVideoTracks()[0];
    if (cameraVideoTrack) {
      for (const peer of peersByIdRef.current.values()) {
        const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
        const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          try {
            await sender.replaceTrack(cameraVideoTrack);
          } catch {
            // ignore
          }
        }
      }
    }
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
    }
    localStreamRef.current = cameraStream;
    setLocalStream(cameraStream);
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
  }, []);

  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

  // Legacy helper: expose the first remote stream as `remoteStream` for the
  // existing 1-1 CallView path.
  const remoteStream = useMemo(() => {
    const first = remoteStreams.values().next().value as
      | RemoteStreamEntry
      | undefined;
    return first?.stream ?? null;
  }, [remoteStreams]);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      peerInfo,
      peers,
      kind,
      callId,
      localStream,
      remoteStream,
      remoteStreams,
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
      peers,
      kind,
      callId,
      localStream,
      remoteStream,
      remoteStreams,
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
