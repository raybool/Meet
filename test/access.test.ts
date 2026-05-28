import { describe, expect, it } from "vitest";
import {
  createRoomAccessToken,
  getRoomAccessCookieName,
  readRoomAccessCookie,
  validateRoomAccess,
  validateRoomCookieAccess,
} from "../lib/access";

const NOW = 1_700_000_000_000;
const ROOM_ID = "eceef22f-bf5c-429c-b87c-c01b3712f928";
const CLIENT_ID = "a12f9df4-85db-4e88-a473-b6289edb5731";
const SECRET = "test-invite-signing-secret";

describe("room access validation", () => {
  it("accepts valid room, client, and room cookie token", () => {
    const token = createRoomAccessToken({
      roomId: ROOM_ID,
      secret: SECRET,
      now: () => NOW,
    });
    const cookies = new Map([[getRoomAccessCookieName(ROOM_ID), { value: token }]]);

    expect(
      validateRoomAccess({
        roomId: ROOM_ID,
        clientId: CLIENT_ID,
        token: readRoomAccessCookie({
          cookies,
          roomId: ROOM_ID,
        }),
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: true,
      roomId: ROOM_ID,
      clientId: CLIENT_ID,
      token,
      });
  });

  it("accepts room cookie access without a client id", () => {
    const token = createRoomAccessToken({
      roomId: ROOM_ID,
      secret: SECRET,
      now: () => NOW,
    });

    expect(
      validateRoomCookieAccess({
        roomId: ROOM_ID,
        token,
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: true,
      roomId: ROOM_ID,
      token,
    });
  });

  it("rejects a missing room cookie token", () => {
    expect(
      validateRoomAccess({
        roomId: ROOM_ID,
        clientId: CLIENT_ID,
        token: null,
        secret: SECRET,
        now: () => NOW,
      }),
    ).toEqual({
      ok: false,
      status: 401,
      reason: "invalid-token",
    });
  });

  it("rejects invalid room and client ids before validating token", () => {
    expect(
      validateRoomAccess({
        roomId: "../bad",
        clientId: CLIENT_ID,
        token: "bad",
        secret: SECRET,
      }),
    ).toEqual({
      ok: false,
      status: 400,
      reason: "invalid-room-id",
    });

    expect(
      validateRoomAccess({
        roomId: ROOM_ID,
        clientId: "bad user",
        token: "bad",
        secret: SECRET,
      }),
    ).toEqual({
      ok: false,
      status: 400,
      reason: "invalid-client-id",
    });
  });

  it("rejects access when the invite signing secret is not configured", () => {
    expect(
      validateRoomAccess({
        roomId: ROOM_ID,
        clientId: CLIENT_ID,
        token: "bad",
        secret: undefined,
      }),
    ).toEqual({
      ok: false,
      status: 500,
      reason: "missing-secret",
    });
  });
});
