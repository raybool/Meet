import { NextRequest, NextResponse } from "next/server";
import {
  buildIceServers,
  generateTurnCredentials,
  parseUrlList,
} from "@/lib/turn";

export const runtime = "nodejs";

const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302"];

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId") ?? "anonymous";
  const turnUrls = parseUrlList(process.env.TURN_URLS);
  const stunUrls = parseUrlList(process.env.STUN_URLS, DEFAULT_STUN_URLS);
  const sharedSecret = process.env.TURN_SHARED_SECRET;

  if (!turnUrls.length || !sharedSecret) {
    return NextResponse.json(
      {
        error:
          "TURN_URLS and TURN_SHARED_SECRET must be configured before calls can start.",
      },
      { status: 500 },
    );
  }

  const turnCredentials = generateTurnCredentials({
    sharedSecret,
    clientId,
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
