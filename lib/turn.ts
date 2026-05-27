import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type TurnCredentials = {
  username: string;
  credential: string;
  expiresAt: number;
};

type GenerateTurnCredentialsOptions = {
  sharedSecret: string;
  clientId: string;
  ttlSeconds?: number;
  now?: () => number;
};

type BuildIceServersOptions = {
  stunUrls: string[];
  turnUrls: string[];
  turnCredentials: TurnCredentials;
};

const DEFAULT_TURN_TTL_SECONDS = 60 * 60;

export function parseUrlList(value: string | undefined, fallback: string[] = []) {
  const urls = value
    ?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return urls?.length ? urls : fallback;
}

export function generateTurnCredentials({
  sharedSecret,
  clientId,
  ttlSeconds = DEFAULT_TURN_TTL_SECONDS,
  now = () => Date.now(),
}: GenerateTurnCredentialsOptions): TurnCredentials {
  if (!sharedSecret.trim()) {
    throw new Error("TURN shared secret is required");
  }

  const safeClientId = sanitizeTurnUsernamePart(clientId);
  const expiresAt = Math.floor(now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:${safeClientId}`;
  const credential = createHmac("sha1", sharedSecret)
    .update(username)
    .digest("base64");

  return { username, credential, expiresAt };
}

export function buildIceServers({
  stunUrls,
  turnUrls,
  turnCredentials,
}: BuildIceServersOptions): IceServer[] {
  const servers: IceServer[] = [];

  if (stunUrls.length > 0) {
    servers.push({ urls: stunUrls });
  }

  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    });
  }

  return servers;
}

function sanitizeTurnUsernamePart(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 80);
  return sanitized || "anonymous";
}
