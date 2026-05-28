import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createInviteToken } from "@/lib/invite";
import { enforceRateLimits, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signingSecret = process.env.INVITE_SIGNING_SECRET;

  if (!signingSecret) {
    return jsonError("Service temporarily unavailable", 500);
  }

  const clientIp = getClientIp(request);
  const rateLimitResponse = await enforceRateLimits(request, [
    {
      identifier: clientIp,
      limit: 10,
      name: "rooms:ip",
      window: "1 m",
    },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const roomId = randomUUID();
  const token = createInviteToken({
    roomId,
    secret: signingSecret,
  });
  const roomPath = `/room/${roomId}?token=${encodeURIComponent(token)}`;
  const inviteUrl = new URL(roomPath, request.url);

  return NextResponse.json(
    {
      roomId,
      roomPath,
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
