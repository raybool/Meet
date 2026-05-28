import { NextRequest, NextResponse } from "next/server";
import {
  buildIceServers,
  generateTurnCredentials,
  parseUrlList,
} from "@/lib/turn";
import {
  ROOM_ID_PATTERN,
  readRoomAccessCookie,
  validateRoomAccess,
} from "@/lib/access";
import { enforceRateLimits, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302"];
const TURN_CREDENTIAL_TTL_SECONDS = 10 * 60;

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("roomId");
  const clientId = request.nextUrl.searchParams.get("clientId");
  const token = readRoomAccessCookie({
    cookies: request.cookies,
    roomId,
  });
  const turnUrls = parseUrlList(process.env.TURN_URLS);
  const stunUrls = parseUrlList(process.env.STUN_URLS, DEFAULT_STUN_URLS);
  const sharedSecret = process.env.TURN_SHARED_SECRET;
  const signingSecret = process.env.INVITE_SIGNING_SECRET;
  const roomRateLimitKey =
    roomId && ROOM_ID_PATTERN.test(roomId) ? roomId : "invalid-room";

  const rateLimitResponse = await enforceRateLimits(request, [
    {
      identifier: getClientIp(request),
      limit: 20,
      name: "ice:ip",
      window: "1 m",
    },
    {
      identifier: roomRateLimitKey,
      limit: 20,
      name: "ice:room",
      window: "1 m",
    },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const access = validateRoomAccess({
    roomId,
    clientId,
    token,
    secret: signingSecret,
  });

  if (!access.ok) {
    return jsonError(
      access.status === 400 ? "Invalid request" : "Unauthorized",
      access.status,
    );
  }

  if (!turnUrls.length || !sharedSecret) {
    return jsonError("Service temporarily unavailable", 500);
  }

  const turnCredentials = generateTurnCredentials({
    sharedSecret,
    clientId: access.clientId,
    ttlSeconds: TURN_CREDENTIAL_TTL_SECONDS,
  });

  return NextResponse.json(
    {
      iceServers: buildIceServers({
        stunUrls,
        turnUrls,
        turnCredentials,
      }),
      expiresAt: turnCredentials.expiresAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
