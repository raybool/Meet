import { NextRequest, NextResponse } from "next/server";
import {
  createRoomAccessToken,
  getRoomAccessCookieName,
  getRoomAccessCookieOptions,
} from "@/lib/access";
import { exchangeInviteCode } from "@/lib/invite-code";
import { enforceRateLimits, getClientIp } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signingSecret = process.env.INVITE_SIGNING_SECRET;
  const redis = getRedis();

  const rateLimitResponse = await enforceRateLimits(request, [
    {
      identifier: getClientIp(request),
      limit: 20,
      name: "invite-exchange:ip",
      window: "1 m",
    },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!signingSecret || !redis) {
    return jsonError("Service temporarily unavailable", 500);
  }

  const code = await readInviteCode(request);

  if (!code) {
    return jsonError("Invalid invite link", 401);
  }

  const exchange = await exchangeInviteCode({ redis, code });

  if (!exchange.ok) {
    return jsonError("Invalid invite link", 401);
  }

  const token = createRoomAccessToken({
    roomId: exchange.roomId,
    secret: signingSecret,
  });
  const roomPath = `/room/${exchange.roomId}`;
  const response = NextResponse.json(
    {
      roomPath,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  response.cookies.set(
    getRoomAccessCookieName(exchange.roomId),
    token,
    getRoomAccessCookieOptions(),
  );

  return response;
}

async function readInviteCode(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: unknown };
    return typeof body.code === "string" ? body.code : null;
  } catch {
    return null;
  }
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
