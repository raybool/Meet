import { NextRequest, NextResponse } from "next/server";
import * as Ably from "ably";
import {
  ROOM_ID_PATTERN,
  readRoomAccessCookie,
  validateRoomAccess,
} from "@/lib/access";
import { enforceRateLimits, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("roomId");
  const clientId = request.nextUrl.searchParams.get("clientId");
  const token = readRoomAccessCookie({
    cookies: request.cookies,
    roomId,
  });
  const apiKey = process.env.ABLY_API_KEY;
  const signingSecret = process.env.INVITE_SIGNING_SECRET;
  const roomRateLimitKey =
    roomId && ROOM_ID_PATTERN.test(roomId) ? roomId : "invalid-room";

  const rateLimitResponse = await enforceRateLimits(request, [
    {
      identifier: getClientIp(request),
      limit: 30,
      name: "ably-token:ip",
      window: "1 m",
    },
    {
      identifier: roomRateLimitKey,
      limit: 30,
      name: "ably-token:room",
      window: "1 m",
    },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!apiKey) {
    return jsonError("Service temporarily unavailable", 500);
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

  const channelName = `room:${access.roomId}`;
  const rest = new Ably.Rest({ key: apiKey });
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId: access.clientId,
    ttl: 60 * 60 * 1000,
    capability: JSON.stringify({
      [channelName]: ["publish", "subscribe", "presence"],
    }),
  });

  return NextResponse.json(tokenRequest, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
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
