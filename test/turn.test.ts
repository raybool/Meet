import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildIceServers,
  generateTurnCredentials,
  parseUrlList,
} from "../lib/turn";

describe("TURN credentials", () => {
  it("generates coturn REST credentials from timestamp and shared secret", () => {
    const credentials = generateTurnCredentials({
      sharedSecret: "secret",
      clientId: "client-1",
      ttlSeconds: 3600,
      now: () => 1_700_000_000_000,
    });

    const expectedUsername = "1700003600:client-1";
    const expectedCredential = createHmac("sha1", "secret")
      .update(expectedUsername)
      .digest("base64");

    expect(credentials).toEqual({
      username: expectedUsername,
      credential: expectedCredential,
      expiresAt: 1_700_003_600,
    });
  });

  it("sanitizes unsafe client id characters", () => {
    const credentials = generateTurnCredentials({
      sharedSecret: "secret",
      clientId: "bad user/../",
      now: () => 1_700_000_000_000,
    });

    expect(credentials.username).toBe("1700003600:bad_user_.._");
  });
});

describe("ICE servers", () => {
  it("parses comma-separated urls with fallback support", () => {
    expect(parseUrlList(" stun:a.example , turn:b.example ")).toEqual([
      "stun:a.example",
      "turn:b.example",
    ]);
    expect(parseUrlList("", ["stun:fallback.example"])).toEqual([
      "stun:fallback.example",
    ]);
  });

  it("builds STUN and TURN server entries", () => {
    expect(
      buildIceServers({
        stunUrls: ["stun:stun.example.com:19302"],
        turnUrls: ["turn:turn.example.com:3478?transport=udp"],
        turnCredentials: {
          username: "1700003600:client-1",
          credential: "abc",
          expiresAt: 1_700_003_600,
        },
      }),
    ).toEqual([
      { urls: ["stun:stun.example.com:19302"] },
      {
        urls: ["turn:turn.example.com:3478?transport=udp"],
        username: "1700003600:client-1",
        credential: "abc",
      },
    ]);
  });
});
