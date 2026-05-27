export type SignalType =
  | "ready"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "leave";

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

  return (
    typeof candidate.senderId === "string" &&
    (candidate.type === "ready" ||
      candidate.type === "offer" ||
      candidate.type === "answer" ||
      candidate.type === "ice-candidate" ||
      candidate.type === "leave")
  );
}
