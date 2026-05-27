import { describe, expect, it } from "vitest";
import { normalizeMembers, selectRoomParticipant } from "../lib/room";

describe("room participant selection", () => {
  it("selects the first participant as host", () => {
    expect(
      selectRoomParticipant([{ clientId: "host", joinedAt: 1 }], "host"),
    ).toEqual({
      state: "active",
      role: "host",
      peerId: null,
      participantIds: ["host"],
    });
  });

  it("selects the second participant as guest", () => {
    expect(
      selectRoomParticipant(
        [
          { clientId: "host", joinedAt: 1 },
          { clientId: "guest", joinedAt: 2 },
        ],
        "guest",
      ),
    ).toEqual({
      state: "active",
      role: "guest",
      peerId: "host",
      participantIds: ["host", "guest"],
    });
  });

  it("keeps the first two participants active when a third appears", () => {
    expect(
      selectRoomParticipant(
        [
          { clientId: "host", joinedAt: 1 },
          { clientId: "guest", joinedAt: 2 },
          { clientId: "third", joinedAt: 3 },
        ],
        "host",
      ),
    ).toEqual({
      state: "active",
      role: "host",
      peerId: "guest",
      participantIds: ["host", "guest", "third"],
    });
  });

  it("marks a third participant as room-full", () => {
    expect(
      selectRoomParticipant(
        [
          { clientId: "host", joinedAt: 1 },
          { clientId: "guest", joinedAt: 2 },
          { clientId: "third", joinedAt: 3 },
        ],
        "third",
      ),
    ).toEqual({
      state: "full",
      role: null,
      peerId: null,
      participantIds: ["host", "guest", "third"],
    });
  });

  it("allows the current participant while their own presence enter is still propagating", () => {
    expect(
      selectRoomParticipant([{ clientId: "host", joinedAt: 1 }], "guest"),
    ).toEqual({
      state: "active",
      role: "guest",
      peerId: "host",
      participantIds: ["host", "guest"],
    });
  });

  it("marks the current participant as full when two other people are already active", () => {
    expect(
      selectRoomParticipant(
        [
          { clientId: "host", joinedAt: 1 },
          { clientId: "guest", joinedAt: 2 },
        ],
        "third",
      ),
    ).toEqual({
      state: "full",
      role: null,
      peerId: null,
      participantIds: ["host", "guest", "third"],
    });
  });

  it("ignores stale participants before deciding the room is full", () => {
    expect(
      selectRoomParticipant(
        [
          { clientId: "old-host", joinedAt: 1_000, lastSeenAt: 1_000 },
          { clientId: "host", joinedAt: 100_000, lastSeenAt: 100_000 },
          { clientId: "guest", joinedAt: 101_000, lastSeenAt: 101_000 },
        ],
        "guest",
        { now: 101_000, activeMemberTtlMs: 45_000 },
      ),
    ).toEqual({
      state: "active",
      role: "guest",
      peerId: "host",
      participantIds: ["host", "guest"],
    });
  });

  it("normalizes duplicate members by earliest join time", () => {
    expect(
      normalizeMembers([
        { clientId: "guest", joinedAt: 20 },
        { clientId: "host", joinedAt: 10 },
        { clientId: "guest", joinedAt: 12 },
      ]),
    ).toEqual([
      { clientId: "host", joinedAt: 10 },
      { clientId: "guest", joinedAt: 12 },
    ]);
  });
});
