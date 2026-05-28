import { describe, expect, it } from "vitest";
import { isSignalMessage } from "../lib/signaling";

const SENDER_ID = "a12f9df4-85db-4e88-a473-b6289edb5731";

describe("signaling message validation", () => {
  it("accepts ready and leave messages with valid sender ids", () => {
    expect(isSignalMessage({ type: "ready", senderId: SENDER_ID })).toBe(true);
    expect(isSignalMessage({ type: "leave", senderId: SENDER_ID })).toBe(true);
  });

  it("accepts valid offer, answer, and ICE candidate payloads", () => {
    expect(
      isSignalMessage({
        type: "offer",
        senderId: SENDER_ID,
        payload: {
          type: "offer",
          sdp: "v=0\r\n",
        },
      }),
    ).toBe(true);

    expect(
      isSignalMessage({
        type: "answer",
        senderId: SENDER_ID,
        payload: {
          type: "answer",
          sdp: "v=0\r\n",
        },
      }),
    ).toBe(true);

    expect(
      isSignalMessage({
        type: "ice-candidate",
        senderId: SENDER_ID,
        payload: {
          candidate: "candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host",
          sdpMid: "0",
          sdpMLineIndex: 0,
          usernameFragment: "ufrag",
        },
      }),
    ).toBe(true);
  });

  it("rejects malformed sender ids and session descriptions", () => {
    expect(isSignalMessage({ type: "ready", senderId: "bad user" })).toBe(false);

    expect(
      isSignalMessage({
        type: "offer",
        senderId: SENDER_ID,
        payload: {
          type: "answer",
          sdp: "v=0\r\n",
        },
      }),
    ).toBe(false);

    expect(
      isSignalMessage({
        type: "answer",
        senderId: SENDER_ID,
        payload: {
          type: "answer",
          sdp: "",
        },
      }),
    ).toBe(false);
  });

  it("rejects oversized or malformed ICE candidates", () => {
    expect(
      isSignalMessage({
        type: "ice-candidate",
        senderId: SENDER_ID,
        payload: {
          candidate: "x".repeat(8_193),
        },
      }),
    ).toBe(false);

    expect(
      isSignalMessage({
        type: "ice-candidate",
        senderId: SENDER_ID,
        payload: {
          candidate: "candidate:1",
          sdpMLineIndex: -1,
        },
      }),
    ).toBe(false);
  });
});
