import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_TOKEN_TTL_SECONDS = 24 * 60 * 60;

const INVITE_TOKEN_VERSION = "v1";
const SIGNATURE_PATTERN = /^[a-zA-Z0-9_-]{32,128}$/;

type CreateInviteTokenOptions = {
  roomId: string;
  secret: string;
  ttlSeconds?: number;
  now?: () => number;
};

type ValidateInviteTokenOptions = {
  roomId: string;
  token: string;
  secret: string;
  now?: () => number;
};

export type InviteTokenValidation =
  | {
      ok: true;
      expiresAt: number;
    }
  | {
      ok: false;
      reason: "expired" | "invalid" | "missing-secret";
    };

export function createInviteToken({
  roomId,
  secret,
  ttlSeconds = INVITE_TOKEN_TTL_SECONDS,
  now = () => Date.now(),
}: CreateInviteTokenOptions) {
  assertInviteSecret(secret);

  const expiresAt = Math.floor(now() / 1000) + ttlSeconds;
  const signature = signInviteToken({ roomId, expiresAt, secret });

  return `${INVITE_TOKEN_VERSION}.${expiresAt}.${signature}`;
}

export function validateInviteToken({
  roomId,
  token,
  secret,
  now = () => Date.now(),
}: ValidateInviteTokenOptions): InviteTokenValidation {
  if (!secret.trim()) {
    return { ok: false, reason: "missing-secret" };
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return { ok: false, reason: "invalid" };
  }

  const [version, expiresAtValue, signature] = parts;

  if (
    version !== INVITE_TOKEN_VERSION ||
    !/^\d{10,}$/.test(expiresAtValue) ||
    !SIGNATURE_PATTERN.test(signature)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const expiresAt = Number(expiresAtValue);

  if (!Number.isSafeInteger(expiresAt)) {
    return { ok: false, reason: "invalid" };
  }

  const expectedSignature = signInviteToken({ roomId, expiresAt, secret });

  if (!safeEqual(signature, expectedSignature)) {
    return { ok: false, reason: "invalid" };
  }

  if (expiresAt <= Math.floor(now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, expiresAt };
}

function assertInviteSecret(secret: string) {
  if (!secret.trim()) {
    throw new Error("INVITE_SIGNING_SECRET is required");
  }
}

function signInviteToken({
  roomId,
  expiresAt,
  secret,
}: {
  roomId: string;
  expiresAt: number;
  secret: string;
}) {
  return createHmac("sha256", secret)
    .update(`${roomId}.${expiresAt}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}
