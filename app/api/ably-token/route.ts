import { NextRequest, NextResponse } from "next/server";
import * as Ably from "ably";

export const runtime = "nodejs";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const CLIENT_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("roomId");
  const clientId = request.nextUrl.searchParams.get("clientId");
  const apiKey = process.env.ABLY_API_KEY;

  if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
    return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  }

  if (!clientId || !CLIENT_ID_PATTERN.test(clientId)) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "ABLY_API_KEY must be configured" },
      { status: 500 },
    );
  }

  const channelName = `room:${roomId}`;
  const rest = new Ably.Rest({ key: apiKey });
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId,
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
