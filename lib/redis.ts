import IORedis, { type RedisOptions } from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  clearframeRedis?: IORedis;
};

export function hasRedis() {
  return Boolean(process.env.REDIS_URL);
}

export function getRedis(): IORedis {
  if (!hasRedis()) {
    throw new Error("REDIS_URL is not configured; standalone database queue mode is active.");
  }
  if (!globalForRedis.clearframeRedis) {
    const options: RedisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    };
    globalForRedis.clearframeRedis = new IORedis(env.redisUrl, options);
  }
  return globalForRedis.clearframeRedis;
}

export async function ensureRedis() {
  const redis = getRedis();
  if (redis.status === "wait" || redis.status === "end") await redis.connect();
  return redis;
}

export async function disconnectRedis() {
  const redis = globalForRedis.clearframeRedis;
  if (!redis) return;
  await redis.quit().catch(() => undefined);
  globalForRedis.clearframeRedis = undefined;
}
