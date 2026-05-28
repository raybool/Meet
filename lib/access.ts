import { validateInviteToken } from "./invite";

export const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
export const CLIENT_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

export type RoomAccess =
  | {
      ok: true;
      roomId: string;
      clientId: string;
      token: string;
    }
  | {
      ok: false;
      status: 400 | 401 | 500;
      reason:
        | "invalid-client-id"
        | "invalid-room-id"
        | "invalid-token"
        | "missing-secret";
    };

export function validateRoomAccess({
  roomId,
  clientId,
  token,
  secret,
  now,
}: {
  roomId: string | null;
  clientId: string | null;
  token: string | null;
  secret: string | undefined;
  now?: () => number;
}): RoomAccess {
  if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
    return { ok: false, status: 400, reason: "invalid-room-id" };
  }

  if (!clientId || !CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, status: 400, reason: "invalid-client-id" };
  }

  if (!token || !secret) {
    return {
      ok: false,
      status: secret ? 401 : 500,
      reason: secret ? "invalid-token" : "missing-secret",
    };
  }

  const tokenValidation = validateInviteToken({
    roomId,
    token,
    secret,
    now,
  });

  if (!tokenValidation.ok) {
    return {
      ok: false,
      status: tokenValidation.reason === "missing-secret" ? 500 : 401,
      reason:
        tokenValidation.reason === "missing-secret"
          ? "missing-secret"
          : "invalid-token",
    };
  }

  return {
    ok: true,
    roomId,
    clientId,
    token,
  };
}
