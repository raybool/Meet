import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_TTL_SECONDS,
  createStoredInviteCode,
  exchangeInviteCode,
  inviteCodeKey,
} from "../lib/invite-code";
import { type RedisClient } from "../lib/redis";

const NOW = 1_700_000_000_000;
const ROOM_ID = "eceef22f-bf5c-429c-b87c-c01b3712f928";

describe("single-use invite codes", () => {
  it("stores a room binding with the expected ttl", async () => {
    const redis = createMemoryRedis();
    const code = await createStoredInviteCode({
      redis,
      roomId: ROOM_ID,
      now: () => NOW,
    });
    const key = inviteCodeKey(code);

    expect(redis.values.get(key)).toEqual({
      roomId: ROOM_ID,
      createdAt: 1_700_000_000,
    });
    expect(redis.ttls.get(key)).toBe(INVITE_CODE_TTL_SECONDS);
  });

  it("exchanges a code once and deletes it", async () => {
    const redis = createMemoryRedis();
    const code = await createStoredInviteCode({
      redis,
      roomId: ROOM_ID,
      now: () => NOW,
    });

    await expect(exchangeInviteCode({ redis, code })).resolves.toEqual({
      ok: true,
      roomId: ROOM_ID,
    });
    await expect(exchangeInviteCode({ redis, code })).resolves.toEqual({
      ok: false,
    });
  });

  it("rejects malformed and missing codes", async () => {
    const redis = createMemoryRedis();

    await expect(exchangeInviteCode({ redis, code: "bad" })).resolves.toEqual({
      ok: false,
    });
  });
});

function createMemoryRedis() {
  const values = new Map<string, unknown>();
  const ttls = new Map<string, number>();

  return {
    values,
    ttls,
    async set<TData>(
      key: string,
      value: TData,
      options?: { ex?: number; nx?: true },
    ) {
      if (options?.nx && values.has(key)) {
        return null;
      }

      values.set(key, value);

      if (options?.ex) {
        ttls.set(key, options.ex);
      }

      return "OK";
    },
    async getdel<TData>(key: string) {
      const value = values.get(key) ?? null;
      values.delete(key);
      ttls.delete(key);
      return value as TData | null;
    },
  } as RedisClient & {
    values: Map<string, unknown>;
    ttls: Map<string, number>;
  };
}
