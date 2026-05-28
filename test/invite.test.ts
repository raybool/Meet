import { describe, expect, it } from "vitest";
import { createInviteToken, validateInviteToken } from "../lib/invite";

const NOW = 1_700_000_000_000;
const ROOM_ID = "eceef22f-bf5c-429c-b87c-c01b3712f928";
const SECRET = "test-invite-signing-secret";

describe("invite tokens", () => {
  it("validates a signed room invite token", () => {
    const token = createInviteToken({
      roomId: ROOM_ID,
      secret: SECRET,
      ttlSeconds: 3600,
      now: () => NOW,
    });

    expect(
      validateInviteToken({
        roomId: ROOM_ID,
        token,
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: true,
      expiresAt: 1_700_003_600,
    });
  });

  it("rejects an expired token", () => {
    const token = createInviteToken({
      roomId: ROOM_ID,
      secret: SECRET,
      ttlSeconds: 3600,
      now: () => NOW,
    });

    expect(
      validateInviteToken({
        roomId: ROOM_ID,
        token,
        secret: SECRET,
        now: () => 1_700_003_600_000,
      }),
    ).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token signed for a different room", () => {
    const token = createInviteToken({
      roomId: ROOM_ID,
      secret: SECRET,
      now: () => NOW,
    });

    expect(
      validateInviteToken({
        roomId: "different-room-id",
        token,
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects a tampered expiry", () => {
    const token = createInviteToken({
      roomId: ROOM_ID,
      secret: SECRET,
      now: () => NOW,
    });
    const [version, expiresAt, signature] = token.split(".");
    const tamperedToken = `${version}.${Number(expiresAt) + 3600}.${signature}`;

    expect(
      validateInviteToken({
        roomId: ROOM_ID,
        token: tamperedToken,
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects malformed tokens", () => {
    expect(
      validateInviteToken({
        roomId: ROOM_ID,
        token: "not-a-token",
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
