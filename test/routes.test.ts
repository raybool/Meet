import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRoomAccessToken,
  getRoomAccessCookieName,
} from "../lib/access";
import { createStoredInviteCode } from "../lib/invite-code";
import { type RedisClient } from "../lib/redis";

const ROOM_ID = "eceef22f-bf5c-429c-b87c-c01b3712f928";
const CLIENT_ID = "a12f9df4-85db-4e88-a473-b6289edb5731";
const SECRET = "test-invite-signing-secret";

const redisState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  ttls: new Map<string, number>(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimits: vi.fn(async () => null),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => createMockRedis()),
}));

describe("invite and protected API routes", () => {
  beforeEach(() => {
    redisState.values.clear();
    redisState.ttls.clear();
    process.env.INVITE_SIGNING_SECRET = SECRET;
    process.env.ABLY_API_KEY = "ably.key:secret";
    process.env.TURN_URLS = "turn:turn.example.com:3478?transport=udp";
    process.env.TURN_SHARED_SECRET = "turn-secret";
  });

  it("creates a room with an HttpOnly cookie and no URL token", async () => {
    const { POST } = await import("../app/api/rooms/route");
    const response = await POST(
      new NextRequest("https://meet.test/api/rooms", {
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      roomId: string;
      roomPath: string;
      inviteUrl: string;
    };
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.roomPath).toBe(`/room/${body.roomId}`);
    expect(body.roomPath).not.toContain("token=");
    expect(body.inviteUrl).not.toContain("token=");
    expect(setCookie).toContain(getRoomAccessCookieName(body.roomId));
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });

  it("creates a single-use invite link for authenticated room access", async () => {
    const { POST } = await import("../app/api/rooms/[roomId]/invites/route");
    const token = createRoomAccessToken({
      roomId: ROOM_ID,
      secret: SECRET,
    });
    const response = await POST(
      new NextRequest(`https://meet.test/api/rooms/${ROOM_ID}/invites`, {
        method: "POST",
        headers: {
          Cookie: `${getRoomAccessCookieName(ROOM_ID)}=${token}`,
        },
      }),
      {
        params: Promise.resolve({ roomId: ROOM_ID }),
      },
    );
    const body = (await response.json()) as {
      invitePath: string;
      inviteUrl: string;
    };

    expect(response.status).toBe(200);
    expect(body.invitePath).toMatch(/^\/join#code=/);
    expect(body.invitePath).not.toContain("token=");
    expect(body.inviteUrl).toContain("/join#code=");
  });

  it("exchanges an invite code for a room cookie without returning a token", async () => {
    const redis = createMockRedis();
    const code = await createStoredInviteCode({
      redis,
      roomId: ROOM_ID,
    });
    const { POST } = await import("../app/api/invites/exchange/route");
    const response = await POST(
      new NextRequest("https://meet.test/api/invites/exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      }),
    );
    const body = (await response.json()) as {
      roomPath: string;
      token?: string;
    };
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body).toEqual({
      roomPath: `/room/${ROOM_ID}`,
    });
    expect(body.token).toBeUndefined();
    expect(setCookie).toContain(getRoomAccessCookieName(ROOM_ID));
    expect(setCookie).toContain("HttpOnly");
  });

  it("rejects a repeated invite code exchange", async () => {
    const redis = createMockRedis();
    const code = await createStoredInviteCode({
      redis,
      roomId: ROOM_ID,
    });
    const { POST } = await import("../app/api/invites/exchange/route");

    await POST(
      new NextRequest("https://meet.test/api/invites/exchange", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    );
    const repeatedResponse = await POST(
      new NextRequest("https://meet.test/api/invites/exchange", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    );

    expect(repeatedResponse.status).toBe(401);
  });

  it("rejects old query-token-only access to ICE and Ably token routes", async () => {
    const token = createRoomAccessToken({
      roomId: ROOM_ID,
      secret: SECRET,
    });
    const query = `roomId=${ROOM_ID}&clientId=${CLIENT_ID}&token=${encodeURIComponent(
      token,
    )}`;
    const [{ GET: getIce }, { GET: getAblyToken }] = await Promise.all([
      import("../app/api/ice/route"),
      import("../app/api/ably-token/route"),
    ]);

    const iceResponse = await getIce(
      new NextRequest(`https://meet.test/api/ice?${query}`),
    );
    const ablyResponse = await getAblyToken(
      new NextRequest(`https://meet.test/api/ably-token?${query}`),
    );

    expect(iceResponse.status).toBe(401);
    expect(ablyResponse.status).toBe(401);
  });
});

function createMockRedis() {
  return {
    async set<TData>(
      key: string,
      value: TData,
      options?: { ex?: number; nx?: true },
    ) {
      if (options?.nx && redisState.values.has(key)) {
        return null;
      }

      redisState.values.set(key, value);

      if (options?.ex) {
        redisState.ttls.set(key, options.ex);
      }

      return "OK";
    },
    async getdel<TData>(key: string) {
      const value = redisState.values.get(key) ?? null;
      redisState.values.delete(key);
      redisState.ttls.delete(key);
      return value as TData | null;
    },
  } as RedisClient;
}
