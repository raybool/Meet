import {
  INVITE_TOKEN_TTL_SECONDS,
  createInviteToken,
  validateInviteToken,
} from "./invite";

export const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
export const CLIENT_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;
export const ROOM_ACCESS_COOKIE_MAX_AGE_SECONDS = INVITE_TOKEN_TTL_SECONDS;

const ROOM_ACCESS_COOKIE_PREFIX = "meet-room";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

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

export type RoomCookieAccess =
  | {
      ok: true;
      roomId: string;
      token: string;
    }
  | {
      ok: false;
      status: 400 | 401 | 500;
      reason: "invalid-room-id" | "invalid-token" | "missing-secret";
    };

export function createRoomAccessToken({
  roomId,
  secret,
  now,
}: {
  roomId: string;
  secret: string;
  now?: () => number;
}) {
  return createInviteToken({
    roomId,
    secret,
    ttlSeconds: ROOM_ACCESS_COOKIE_MAX_AGE_SECONDS,
    now,
  });
}

export function getRoomAccessCookieName(roomId: string) {
  return `${ROOM_ACCESS_COOKIE_PREFIX}-${roomId}`;
}

export function getRoomAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ROOM_ACCESS_COOKIE_MAX_AGE_SECONDS,
  };
}

export function readRoomAccessCookie({
  cookies,
  roomId,
}: {
  cookies: CookieReader;
  roomId: string | null;
}) {
  if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
    return null;
  }

  return cookies.get(getRoomAccessCookieName(roomId))?.value ?? null;
}

export function validateRoomCookieAccess({
  roomId,
  token,
  secret,
  now,
}: {
  roomId: string | null;
  token: string | null;
  secret: string | undefined;
  now?: () => number;
}): RoomCookieAccess {
  if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
    return { ok: false, status: 400, reason: "invalid-room-id" };
  }

  const tokenAccess = validateRoomToken({
    roomId,
    token,
    secret,
    now,
  });

  if (!tokenAccess.ok) {
    return tokenAccess;
  }

  return {
    ok: true,
    roomId,
    token: tokenAccess.token,
  };
}

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

  const tokenAccess = validateRoomToken({
    roomId,
    token,
    secret,
    now,
  });

  if (!tokenAccess.ok) {
    return tokenAccess;
  }

  return {
    ok: true,
    roomId,
    clientId,
    token: tokenAccess.token,
  };
}

function validateRoomToken({
  roomId,
  token,
  secret,
  now,
}: {
  roomId: string;
  token: string | null;
  secret: string | undefined;
  now?: () => number;
}): RoomCookieAccess {
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
    token,
  };
}
