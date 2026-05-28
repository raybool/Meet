import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "./redis";

type RateLimitWindow = Parameters<typeof Ratelimit.slidingWindow>[1];

type RateLimitRule = {
  identifier: string;
  limit: number;
  name: string;
  window: RateLimitWindow;
};

const limiters = new Map<string, Ratelimit>();

export async function enforceRateLimits(
  request: NextRequest,
  rules: RateLimitRule[],
) {
  const clientIp = getClientIp(request);
  const limiterRedis = getRedis();

  if (!limiterRedis) {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 500 },
    );
  }

  for (const rule of rules) {
    const limiter = getLimiter(limiterRedis, rule);
    const result = await limiter.limit(`${rule.name}:${rule.identifier || clientIp}`);

    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.reset),
          },
        },
      );
    }
  }

  return null;
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function getLimiter(redisClient: Redis, rule: RateLimitRule) {
  const key = `${rule.name}:${rule.limit}:${rule.window}`;
  const existing = limiters.get(key);

  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
    prefix: `meet:${rule.name}`,
  });

  limiters.set(key, limiter);
  return limiter;
}
