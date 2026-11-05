import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ensureRedis, hasRedis } from "@/lib/redis";
import { getStorage } from "@/lib/storage";

const CLEANUP_LOCK_KEY = "clearframe:cleanup:lock";
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

export interface CleanupResult {
  deletedOutputs: number;
  expiredMedia: number;
  deletedObjects: number;
}

export async function cleanupExpired(): Promise<CleanupResult> {
  const storage = getStorage();
  const now = new Date();
  let deletedObjects = 0;

  const expiredOutputs = await prisma.conversionOutput.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true, objectKey: true },
    take: 500,
  });

  for (const output of expiredOutputs) {
    try {
      await storage.deleteObject(output.objectKey);
      deletedObjects += 1;
    } catch (error) {
      console.warn("[clearframe] Could not delete expired output object", output.id, error);
    }
  }
  if (expiredOutputs.length) {
    await prisma.conversionOutput.deleteMany({ where: { id: { in: expiredOutputs.map((item) => item.id) } } });
  }

  const expiredMedia = await prisma.mediaFile.findMany({
    where: {
      expiresAt: { lte: now },
      status: { not: "EXPIRED" },
      jobs: { none: { status: { in: ["QUEUED", "PROCESSING"] } } },
    },
    select: {
      id: true,
      sourceKey: true,
      thumbnailKey: true,
      previewKey: true,
      jobs: { select: { outputs: { select: { objectKey: true } } } },
    },
    take: 500,
  });

  for (const media of expiredMedia) {
    const keys = [
      media.sourceKey,
      media.thumbnailKey,
      media.previewKey,
      ...media.jobs.flatMap((job) => job.outputs.map((output) => output.objectKey)),
    ].filter((key): key is string => Boolean(key));
    for (const key of new Set(keys)) {
      try {
        await storage.deleteObject(key);
        deletedObjects += 1;
      } catch (error) {
        console.warn("[clearframe] Could not delete expired media object", key, error);
      }
    }
  }
  if (expiredMedia.length) {
    await prisma.mediaFile.updateMany({
      where: { id: { in: expiredMedia.map((item) => item.id) } },
      data: { status: "EXPIRED" },
    });
  }

  return {
    deletedOutputs: expiredOutputs.length,
    expiredMedia: expiredMedia.length,
    deletedObjects,
  };
}

export async function cleanupWithLock() {
  if (!hasRedis()) return cleanupExpired();
  const redis = await ensureRedis();
  const token = randomUUID();
  const acquired = await redis.set(CLEANUP_LOCK_KEY, token, "PX", 5 * 60_000, "NX");
  if (acquired !== "OK") return { deletedOutputs: 0, expiredMedia: 0, deletedObjects: 0 };
  try {
    return await cleanupExpired();
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, CLEANUP_LOCK_KEY, token).catch(() => undefined);
  }
}

export async function purgeGuestData(userId: string) {
  const storage = getStorage();
  const media = await prisma.mediaFile.findMany({
    where: { userId },
    select: {
      sourceKey: true,
      thumbnailKey: true,
      previewKey: true,
      jobs: { select: { outputs: { select: { objectKey: true } } } },
    },
  });
  const keys = media.flatMap((item) => [
    item.sourceKey,
    item.thumbnailKey,
    item.previewKey,
    ...item.jobs.flatMap((job) => job.outputs.map((output) => output.objectKey)),
  ]).filter((key): key is string => Boolean(key));
  await Promise.all([...new Set(keys)].map((key) => storage.deleteObject(key).catch(() => undefined)));
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  return { deletedObjects: new Set(keys).size };
}

export function cleanupIntervalMs() {
  return Math.max(60_000, Math.min(env.retentionHours * 3600_000, 15 * 60_000));
}
