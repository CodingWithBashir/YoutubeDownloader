import type { NextRequest } from "next/server";
import { ensureRedis, hasRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { ApiError, tooManyRequests } from "@/lib/errors";
import { fingerprint } from "@/lib/crypto";

type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

function clientFingerprint(request: NextRequest, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
  return fingerprint(`${scope}:${address}`);
}

async function consumeMemory(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: windowSeconds };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

export async function rateLimit(
  request: NextRequest,
  action: "uploads" | "imports" | "jobs" | "downloads" | "admin",
  subject?: string,
) {
  const limits = {
    uploads: env.rateLimitUploads,
    imports: env.rateLimitImports,
    jobs: env.rateLimitJobs,
    downloads: 120,
    admin: 30,
  } as const;
  const limit = limits[action];
  const windowSeconds = env.rateLimitWindowSeconds;
  const key = `cf:rl:${action}:${subject || clientFingerprint(request, action)}`;

  if (!hasRedis()) {
    const result = await consumeMemory(key, limit, windowSeconds);
    if (!result.allowed) throw tooManyRequests("Too many requests. Please wait before trying again.", result.retryAfter);
    return;
  }

  try {
    const redis = await ensureRedis();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    if (count > limit) {
      const ttl = await redis.ttl(key);
      throw tooManyRequests("Too many requests. Please wait before trying again.", ttl > 0 ? ttl : windowSeconds);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "The rate-limit service is unavailable. Please try again shortly.");
  }
}
