import { NextRequest, NextResponse } from "next/server";
import {
  ROOM_ID_PATTERN,
  readRoomAccessCookie,
  validateRoomCookieAccess,
} from "@/lib/access";
import { createStoredInviteCode } from "@/lib/invite-code";
import { enforceRateLimits, getClientIp } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

type InviteRouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function POST(request: NextRequest, context: InviteRouteContext) {
  const { roomId } = await context.params;
  const signingSecret = process.env.INVITE_SIGNING_SECRET;
  const redis = getRedis();
  const roomRateLimitKey = ROOM_ID_PATTERN.test(roomId) ? roomId : "invalid-room";

  const rateLimitResponse = await enforceRateLimits(request, [
    {
      identifier: getClientIp(request),
      limit: 10,
      name: "room-invites:ip",
      window: "1 m",
    },
    {
      identifier: roomRateLimitKey,
      limit: 10,
      name: "room-invites:room",
      window: "1 m",
    },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!redis) {
    return jsonError("Service temporarily unavailable", 500);
  }

  const access = validateRoomCookieAccess({
    roomId,
    token: readRoomAccessCookie({
      cookies: request.cookies,
      roomId,
    }),
    secret: signingSecret,
  });

  if (!access.ok) {
    return jsonError(
      access.status === 400 ? "Invalid request" : "Unauthorized",
      access.status,
    );
  }

  const code = await createStoredInviteCode({
    redis,
    roomId: access.roomId,
  });
  const invitePath = `/join#code=${encodeURIComponent(code)}`;
  const inviteUrl = new URL(invitePath, request.url);

  return NextResponse.json(
    {
      invitePath,
      inviteUrl: inviteUrl.toString(),
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
