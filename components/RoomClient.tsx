"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Ably from "ably";
import {
  Copy,
  Link2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import {
  ACTIVE_MEMBER_TTL_MS,
  type RoomRole,
  selectRoomParticipant,
} from "@/lib/room";
import { type IceServer } from "@/lib/turn";
import { type SignalMessage, isSignalMessage } from "@/lib/signaling";

type CallStatus =
  | "idle"
  | "media"
  | "connecting"
  | "waiting"
  | "connected"
  | "left"
  | "full"
  | "error";

type IceResponse = {
  iceServers: IceServer[];
  expiresAt: number;
};

type AblyRealtimeClient = InstanceType<typeof Ably.Realtime>;
type AblyChannel = ReturnType<AblyRealtimeClient["channels"]["get"]>;

const CLIENT_ID_KEY = "meet-client-id";

export function RoomClient({ roomId }: { roomId: string }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [role, setRole] = useState<RoomRole | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [inviteUrl, setInviteUrl] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const ablyRef = useRef<AblyRealtimeClient | null>(null);
  const channelRef = useRef<AblyChannel | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<IceServer[]>([]);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const roleRef = useRef<RoomRole | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const readySentToPeerRef = useRef<string | null>(null);
  const offerCreatedForPeerRef = useRef<string | null>(null);
  const presenceHeartbeatRef = useRef<number | null>(null);
  const isJoiningRef = useRef(false);

  useEffect(() => {
    const nextClientId = getOrCreateClientId();
    clientIdRef.current = nextClientId;
    setClientId(nextClientId);
  }, []);

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/room/${roomId}`);
  }, [roomId]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);

  const publishSignal = useCallback(async (message: SignalMessage) => {
    const channel = channelRef.current;

    if (!channel) {
      return;
    }

    await channel.publish("signal", message);
  }, []);

  const closePeerConnection = useCallback(() => {
    peerConnectionRef.current?.getSenders().forEach((sender) => {
      peerConnectionRef.current?.removeTrack(sender);
    });
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingIceCandidatesRef.current = [];
    readySentToPeerRef.current = null;
    offerCreatedForPeerRef.current = null;
    setRemoteStream(null);
  }, []);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const stopPresenceHeartbeat = useCallback(() => {
    if (presenceHeartbeatRef.current) {
      window.clearInterval(presenceHeartbeatRef.current);
      presenceHeartbeatRef.current = null;
    }
  }, []);

  const startPresenceHeartbeat = useCallback(
    (channel: AblyChannel, joinedAt: number) => {
      stopPresenceHeartbeat();
      presenceHeartbeatRef.current = window.setInterval(() => {
        void channel.presence.update({
          joinedAt,
          lastSeenAt: Date.now(),
        });
      }, 10_000);
    },
    [stopPresenceHeartbeat],
  );

  const cleanupResourcesSilently = useCallback(() => {
    stopPresenceHeartbeat();
    channelRef.current?.unsubscribe();
    channelRef.current?.presence.unsubscribe();
    ablyRef.current?.close();
    channelRef.current = null;
    ablyRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingIceCandidatesRef.current = [];
    readySentToPeerRef.current = null;
    offerCreatedForPeerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    localStreamRef.current = null;
  }, [stopPresenceHeartbeat]);

  const getPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) {
        peerConnection.addTrack(track, localStreamRef.current);
      }
    });

    peerConnection.ontrack = (event) => {
      setRemoteStream(event.streams[0] ?? null);
    };

    peerConnection.onicecandidate = (event) => {
      const senderId = clientIdRef.current;

      if (!event.candidate || !senderId) {
        return;
      }

      void publishSignal({
        type: "ice-candidate",
        senderId,
        payload: event.candidate.toJSON(),
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        setStatus("connected");
      }

      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        setStatus("waiting");
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [publishSignal]);

  const flushPendingIceCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;

    if (!peerConnection?.remoteDescription) {
      return;
    }

    const candidates = pendingIceCandidatesRef.current.splice(0);

    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(candidate);
    }
  }, []);

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      const currentClientId = clientIdRef.current;
      const currentPeerId = peerIdRef.current;

      if (!currentClientId || message.senderId === currentClientId) {
        return;
      }

      if (currentPeerId && message.senderId !== currentPeerId) {
        return;
      }

      try {
        if (message.type === "ready" && roleRef.current === "host") {
          if (offerCreatedForPeerRef.current === message.senderId) {
            return;
          }

          offerCreatedForPeerRef.current = message.senderId;
          const peerConnection = getPeerConnection();
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await publishSignal({
            type: "offer",
            senderId: currentClientId,
            payload: offer,
          });
        }

        if (message.type === "offer" && roleRef.current === "guest") {
          const peerConnection = getPeerConnection();
          await peerConnection.setRemoteDescription(message.payload);
          await flushPendingIceCandidates();
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          await publishSignal({
            type: "answer",
            senderId: currentClientId,
            payload: answer,
          });
          setStatus("connecting");
        }

        if (message.type === "answer" && roleRef.current === "host") {
          const peerConnection = getPeerConnection();
          await peerConnection.setRemoteDescription(message.payload);
          await flushPendingIceCandidates();
          setStatus("connecting");
        }

        if (message.type === "ice-candidate") {
          const peerConnection = getPeerConnection();

          if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(message.payload);
          } else {
            pendingIceCandidatesRef.current.push(message.payload);
          }
        }

        if (message.type === "leave") {
          closePeerConnection();
          setStatus("waiting");
        }
      } catch (signalError) {
        setError(toErrorMessage(signalError));
        setStatus("error");
      }
    },
    [closePeerConnection, flushPendingIceCandidates, getPeerConnection, publishSignal],
  );

  const refreshPresence = useCallback(async () => {
    const channel = channelRef.current;
    const currentClientId = clientIdRef.current;

    if (!channel || !currentClientId) {
      return;
    }

    const members = await channel.presence.get();
    const selection = selectRoomParticipant(
      members.map((member) => ({
        clientId: member.clientId,
        joinedAt: readJoinedAt(member.data),
        lastSeenAt: readLastSeenAt(member.data),
      })),
      currentClientId,
      { activeMemberTtlMs: ACTIVE_MEMBER_TTL_MS },
    );

    setParticipantCount(Math.min(selection.participantIds.length, 2));

    if (selection.state === "full") {
      setStatus("full");
      setRole(null);
      setPeerId(null);
      await channel.presence.leave();
      channel.unsubscribe();
      channel.presence.unsubscribe();
      ablyRef.current?.close();
      channelRef.current = null;
      ablyRef.current = null;
      closePeerConnection();
      stopLocalMedia();
      return;
    }

    setRole(selection.role);

    if (peerIdRef.current && peerIdRef.current !== selection.peerId) {
      closePeerConnection();
    }

    setPeerId(selection.peerId);

    if (!selection.peerId) {
      closePeerConnection();
      setStatus("waiting");
      return;
    }

    setStatus("connecting");

    if (
      selection.role === "guest" &&
      readySentToPeerRef.current !== selection.peerId
    ) {
      readySentToPeerRef.current = selection.peerId;
      await publishSignal({
        type: "ready",
        senderId: currentClientId,
      });
    }
  }, [closePeerConnection, publishSignal, stopLocalMedia]);

  const joinRoom = useCallback(async () => {
    if (!clientId || isJoiningRef.current) {
      return;
    }

    isJoiningRef.current = true;
    setError(null);
    setStatus("media");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicEnabled(true);
      setCameraEnabled(true);
      setStatus("connecting");

      const iceResponse = await fetch(
        `/api/ice?clientId=${encodeURIComponent(clientId)}`,
        { cache: "no-store" },
      );

      if (!iceResponse.ok) {
        throw new Error(await readApiError(iceResponse));
      }

      const { iceServers } = (await iceResponse.json()) as IceResponse;
      iceServersRef.current = iceServers;

      const realtime = new Ably.Realtime({
        authUrl: `/api/ably-token?roomId=${encodeURIComponent(
          roomId,
        )}&clientId=${encodeURIComponent(clientId)}`,
        authMethod: "GET",
        clientId,
      });

      ablyRef.current = realtime;
      await realtime.connection.once("connected");

      const channel = realtime.channels.get(`room:${roomId}`);
      channelRef.current = channel;

      await channel.subscribe("signal", (ablyMessage) => {
        if (isSignalMessage(ablyMessage.data)) {
          void handleSignal(ablyMessage.data);
        }
      });

      await channel.presence.subscribe(() => {
        void refreshPresence();
      });

      const joinedAt = Date.now();
      await channel.presence.enter({
        joinedAt,
        lastSeenAt: joinedAt,
      });
      startPresenceHeartbeat(channel, joinedAt);
      await refreshPresence();
    } catch (joinError) {
      setError(toErrorMessage(joinError));
      setStatus("error");
      channelRef.current?.unsubscribe();
      channelRef.current?.presence.unsubscribe();
      ablyRef.current?.close();
      channelRef.current = null;
      ablyRef.current = null;
      closePeerConnection();
      stopLocalMedia();
    } finally {
      isJoiningRef.current = false;
    }
  }, [
    clientId,
    closePeerConnection,
    handleSignal,
    refreshPresence,
    roomId,
    startPresenceHeartbeat,
    stopLocalMedia,
  ]);

  const leaveRoom = useCallback(async () => {
    const currentClientId = clientIdRef.current;

    stopPresenceHeartbeat();

    if (currentClientId) {
      await publishSignal({
        type: "leave",
        senderId: currentClientId,
      });
    }

    try {
      await channelRef.current?.presence.leave();
    } catch {
      // The channel can already be detached when leaving after an auth error.
    }

    channelRef.current?.unsubscribe();
    channelRef.current?.presence.unsubscribe();
    ablyRef.current?.close();
    channelRef.current = null;
    ablyRef.current = null;
    closePeerConnection();
    stopLocalMedia();
    setRole(null);
    setPeerId(null);
    setParticipantCount(0);
    setStatus("left");
  }, [closePeerConnection, publishSignal, stopLocalMedia, stopPresenceHeartbeat]);

  const reconnectRoom = useCallback(async () => {
    await leaveRoom();
    await joinRoom();
  }, [joinRoom, leaveRoom]);

  useEffect(() => {
    return () => {
      void channelRef.current?.presence.leave();
      cleanupResourcesSilently();
    };
  }, [cleanupResourcesSilently]);

  async function copyInvite() {
    if (!inviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(
        "Clipboard permission was blocked. Use the Invite link or copy the room URL from the address bar.",
      );
    }
  }

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !micEnabled;
    });
    setMicEnabled((enabled) => !enabled);
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraEnabled;
    });
    setCameraEnabled((enabled) => !enabled);
  }

  return (
    <main className="min-h-screen bg-[#eef4f1] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Users aria-hidden="true" className="h-4 w-4" />
              <span>{participantCount}/2 participants</span>
            </div>
            <h1 className="mt-1 truncate text-lg font-semibold text-slate-950">
              Room {roomId}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInvite}
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              title="Copy invite link"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={inviteUrl}
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              title="Open invite link"
            >
              <Link2 aria-hidden="true" className="h-4 w-4" />
              Invite
            </a>
          </div>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid min-h-[420px] gap-4 md:grid-cols-2">
            <VideoTile
              label="You"
              stream={localStream}
              videoRef={localVideoRef}
              muted
              isLocal
            />
            <VideoTile
              label={peerId ? "Guest" : "Waiting"}
              stream={remoteStream}
              videoRef={remoteVideoRef}
            />
          </div>

          <aside className="flex flex-col justify-between rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                  Status
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {statusLabel(status)}
                </p>
                {role && (
                  <p className="mt-1 text-sm text-slate-600">
                    You are the {role}.
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
                  {error}
                </div>
              )}

              {status === "full" && (
                <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  This room already has two participants.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <ControlButton
                  onClick={toggleMic}
                  disabled={!localStream}
                  title={micEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {micEnabled ? (
                    <Mic aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <MicOff aria-hidden="true" className="h-5 w-5" />
                  )}
                  <span>{micEnabled ? "Mute" : "Unmute"}</span>
                </ControlButton>
                <ControlButton
                  onClick={toggleCamera}
                  disabled={!localStream}
                  title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                >
                  {cameraEnabled ? (
                    <Video aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <VideoOff aria-hidden="true" className="h-5 w-5" />
                  )}
                  <span>{cameraEnabled ? "Camera" : "Camera off"}</span>
                </ControlButton>
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              {status === "idle" ||
              status === "left" ||
              status === "error" ||
              status === "full" ? (
                <button
                  type="button"
                  onClick={joinRoom}
                  disabled={!clientId}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-70"
                >
                  <Video aria-hidden="true" className="h-5 w-5" />
                  {status === "full" ? "Try again" : "Join room"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={leaveRoom}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-rose-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-800"
                >
                  <PhoneOff aria-hidden="true" className="h-5 w-5" />
                  Leave room
                </button>
              )}

              {status === "waiting" && (
                <button
                  type="button"
                  onClick={reconnectRoom}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  Reconnect
                </button>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

type VideoTileProps = {
  label: string;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  isLocal?: boolean;
};

function VideoTile({
  label,
  stream,
  videoRef,
  muted = false,
  isLocal = false,
}: VideoTileProps) {
  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-[8px] bg-slate-950 shadow-call">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-full min-h-[320px] w-full object-cover"
      />
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-300">
          <div className="text-center">
            <VideoOff aria-hidden="true" className="mx-auto h-8 w-8" />
            <p className="mt-3 text-sm font-medium">
              {isLocal ? "Camera preview" : "Remote video"}
            </p>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 rounded-[8px] bg-black/55 px-3 py-1 text-sm font-semibold text-white">
        {label}
      </div>
    </div>
  );
}

function ControlButton({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function statusLabel(status: CallStatus) {
  switch (status) {
    case "idle":
      return "Ready to join";
    case "media":
      return "Starting camera";
    case "connecting":
      return "Connecting";
    case "waiting":
      return "Waiting for peer";
    case "connected":
      return "Connected";
    case "left":
      return "Left room";
    case "full":
      return "Room is full";
    case "error":
      return "Needs attention";
  }
}

function getOrCreateClientId() {
  const existing = window.sessionStorage.getItem(CLIENT_ID_KEY);

  if (existing) {
    return existing;
  }

  const clientId = crypto.randomUUID();
  window.sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

function readJoinedAt(value: unknown) {
  const data = value as { joinedAt?: unknown } | null;

  if (
    data &&
    typeof data === "object" &&
    "joinedAt" in data &&
    typeof data.joinedAt === "number"
  ) {
    return data.joinedAt;
  }

  return 0;
}

function readLastSeenAt(value: unknown) {
  const data = value as { lastSeenAt?: unknown } | null;

  if (
    data &&
    typeof data === "object" &&
    "lastSeenAt" in data &&
    typeof data.lastSeenAt === "number"
  ) {
    return data.lastSeenAt;
  }

  return undefined;
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("required 'presence' capability")) {
      return "The Ably API key is missing the presence capability. In Ably, enable publish, subscribe, and presence for room:* channels, then restart the app.";
    }

    return error.message;
  }

  return "Something went wrong while starting the call.";
}
