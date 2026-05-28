export type SignalType =
  | "ready"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "leave";

const CLIENT_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;
const MAX_SDP_LENGTH = 200_000;
const MAX_ICE_CANDIDATE_LENGTH = 8_192;

export type SignalMessage =
  | {
      type: "ready";
      senderId: string;
    }
  | {
      type: "offer";
      senderId: string;
      payload: RTCSessionDescriptionInit;
    }
  | {
      type: "answer";
      senderId: string;
      payload: RTCSessionDescriptionInit;
    }
  | {
      type: "ice-candidate";
      senderId: string;
      payload: RTCIceCandidateInit;
    }
  | {
      type: "leave";
      senderId: string;
    };

export function isSignalMessage(value: unknown): value is SignalMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SignalMessage>;

  if (
    typeof candidate.senderId !== "string" ||
    !CLIENT_ID_PATTERN.test(candidate.senderId)
  ) {
    return false;
  }

  if (candidate.type === "ready" || candidate.type === "leave") {
    return true;
  }

  if (candidate.type === "offer" || candidate.type === "answer") {
    return isSessionDescription(candidate.payload, candidate.type);
  }

  if (candidate.type === "ice-candidate") {
    return isIceCandidate(candidate.payload);
  }

  return false;
}

function isSessionDescription(
  value: unknown,
  expectedType: "offer" | "answer",
): value is RTCSessionDescriptionInit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const description = value as Partial<RTCSessionDescriptionInit>;

  return (
    description.type === expectedType &&
    typeof description.sdp === "string" &&
    description.sdp.length > 0 &&
    description.sdp.length <= MAX_SDP_LENGTH
  );
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RTCIceCandidateInit>;

  return (
    typeof candidate.candidate === "string" &&
    candidate.candidate.length <= MAX_ICE_CANDIDATE_LENGTH &&
    isOptionalShortString(candidate.sdpMid, 128) &&
    isOptionalInteger(candidate.sdpMLineIndex, 0, 1024) &&
    isOptionalShortString(candidate.usernameFragment, 256)
  );
}

function isOptionalShortString(value: unknown, maxLength: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= maxLength)
  );
}

function isOptionalInteger(value: unknown, min: number, max: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max)
  );
}
