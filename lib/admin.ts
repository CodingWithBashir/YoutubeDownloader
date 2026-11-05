import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { ApiError, serviceUnavailable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getQueueMetrics, queueMode } from "@/lib/queue";
import { getStorage, storageDriver } from "@/lib/storage";
import { hasRedis, ensureRedis } from "@/lib/redis";
import { readWorkerHeartbeat } from "@/lib/worker-status";
import { publicConfig } from "@/lib/env";

export const ADMIN_HEADER = "x-clearframe-admin-key";

export function assertAdminRequest(request: NextRequest) {
  const configured = env.adminToken;
  if (!configured || configured.length < 16) {
    throw serviceUnavailable("Admin access is not configured. Set ADMIN_TOKEN to a strong random value.");
  }
  const provided = request.headers.get(ADMIN_HEADER) || "";
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(configured).digest();
  if (!provided || !timingSafeEqual(providedHash, expectedHash)) {
    throw new ApiError(401, "ADMIN_UNAUTHORIZED", "A valid admin access key is required.");
  }
}

export async function adminOverview() {
  const [users, media, jobs, outputs, activeJobs, failedJobs, recentFailures, heartbeat, queue] = await Promise.all([
    prisma.user.count(),
    prisma.mediaFile.count(),
    prisma.conversionJob.count(),
    prisma.conversionOutput.count(),
    prisma.conversionJob.count({ where: { status: { in: ["QUEUED", "PROCESSING"] } } }),
    prisma.conversionJob.count({ where: { status: "FAILED" } }),
    prisma.conversionJob.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, targetFormat: true, errorCode: true, errorMessage: true, createdAt: true },
    }),
    readWorkerHeartbeat(),
    getQueueMetrics(),
  ]);

  const checks: Record<string, "ok" | "error" | "not-configured"> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }
  try {
    if (hasRedis()) await ensureRedis().then((redis) => redis.ping());
    checks.redis = hasRedis() ? "ok" : "not-configured";
  } catch {
    checks.redis = "error";
  }
  try {
    await getStorage().ping();
    checks.storage = "ok";
  } catch {
    checks.storage = "error";
  }

  return {
    generatedAt: new Date().toISOString(),
    queueMode,
    storageDriver: storageDriver(),
    config: publicConfig(),
    checks,
    counts: { users, media, jobs, outputs, activeJobs, failedJobs },
    queue,
    worker: heartbeat,
    recentFailures,
  };
}
