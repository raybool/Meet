import { randomBytes } from "node:crypto";
import { ROOM_ID_PATTERN } from "./access";
import { INVITE_TOKEN_TTL_SECONDS } from "./invite";
import { type RedisClient } from "./redis";

export const INVITE_CODE_TTL_SECONDS = INVITE_TOKEN_TTL_SECONDS;

const INVITE_CODE_BYTES = 32;
const INVITE_CODE_PATTERN = /^[a-zA-Z0-9_-]{32,128}$/;
const INVITE_CODE_KEY_PREFIX = "meet:invite";
const MAX_CREATE_ATTEMPTS = 3;

type InviteCodeRecord = {
  roomId: string;
  createdAt: number;
};

export function createInviteCode() {
  return randomBytes(INVITE_CODE_BYTES).toString("base64url");
}

export async function createStoredInviteCode({
  redis,
  roomId,
  ttlSeconds = INVITE_CODE_TTL_SECONDS,
  now = () => Date.now(),
}: {
  redis: RedisClient;
  roomId: string;
  ttlSeconds?: number;
  now?: () => number;
}) {
  if (!ROOM_ID_PATTERN.test(roomId)) {
    throw new Error("Invalid room id");
  }

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const code = createInviteCode();
    const stored = await redis.set(
      inviteCodeKey(code),
      {
        roomId,
        createdAt: Math.floor(now() / 1000),
      },
      { ex: ttlSeconds, nx: true },
    );

    if (stored === "OK") {
      return code;
    }
  }

  throw new Error("Unable to create invite code");
}

export async function exchangeInviteCode({
  redis,
  code,
}: {
  redis: RedisClient;
  code: string;
}) {
  if (!INVITE_CODE_PATTERN.test(code)) {
    return { ok: false as const };
  }

  const record = await redis.getdel<InviteCodeRecord>(inviteCodeKey(code));

  if (!isInviteCodeRecord(record)) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    roomId: record.roomId,
  };
}

export function inviteCodeKey(code: string) {
  return `${INVITE_CODE_KEY_PREFIX}:${code}`;
}

function isInviteCodeRecord(value: unknown): value is InviteCodeRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<InviteCodeRecord>;

  return (
    typeof record.roomId === "string" &&
    ROOM_ID_PATTERN.test(record.roomId) &&
    typeof record.createdAt === "number" &&
    Number.isSafeInteger(record.createdAt)
  );
}
