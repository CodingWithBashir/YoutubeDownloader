import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { Worker } from "bullmq";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { disconnectRedis, ensureRedis, getRedis, hasRedis } from "@/lib/redis";
import { JOB_CANCEL_CHANNEL, bullConnection, queueMode } from "@/lib/queue";
import { cleanupIntervalMs, cleanupWithLock } from "@/lib/cleanup";
import { writeWorkerHeartbeat } from "@/lib/worker-status";
import { cancelActiveJob } from "@/worker/active-jobs";
import { processConversionJob } from "@/worker/process-job";
import type { ConversionQueuePayload, ConversionQueueResult } from "@/lib/queue";

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const mode = queueMode();
const intervals: NodeJS.Timeout[] = [];
let bullWorker: Worker<ConversionQueuePayload, ConversionQueueResult, "convert"> | undefined;
let redisSubscriber: ReturnType<ReturnType<typeof getRedis>["duplicate"]> | undefined;
const pollerActive = new Set<string>();
let shuttingDown = false;

async function pollDatabaseQueue() {
  if (shuttingDown) return;
  const capacity = Math.max(0, env.workerConcurrency - pollerActive.size);
  if (!capacity) return;
  try {
    const candidates = await prisma.conversionJob.findMany({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take: capacity,
      select: { id: true },
    });
    for (const candidate of candidates) {
      const claimed = await prisma.conversionJob.updateMany({
        where: { id: candidate.id, status: "QUEUED" },
        data: { status: "PROCESSING", stage: "Claimed" },
      });
      if (!claimed.count) continue;
      pollerActive.add(candidate.id);
      void processConversionJob(candidate.id, workerId).finally(() => pollerActive.delete(candidate.id));
    }
  } catch (error) {
    console.error("[clearframe] Database queue poll failed", error);
  }
}

async function heartbeat() {
  const heartbeat = {
    workerId,
    mode: mode as "bullmq" | "database-poller",
    timestamp: new Date().toISOString(),
    pid: process.pid,
  };
  await writeWorkerHeartbeat(heartbeat).catch((error) => console.warn("[clearframe] Heartbeat failed", error));
}

async function start() {
  console.log(`[clearframe] Worker ${workerId} starting in ${mode} mode`);

  if (hasRedis()) {
    await ensureRedis();
    redisSubscriber = getRedis().duplicate();
    await redisSubscriber.connect();
    await redisSubscriber.subscribe(JOB_CANCEL_CHANNEL);
    redisSubscriber.on("message", (_channel, jobId) => cancelActiveJob(jobId));
    bullWorker = new Worker<ConversionQueuePayload, ConversionQueueResult, "convert">(
      env.queueName,
      async (job) => {
        const result = await processConversionJob(job.data.jobId, workerId);
        const current = await prisma.conversionJob.findUnique({
          where: { id: job.data.jobId },
          select: { progress: true, status: true },
        });
        if (current) await job.updateProgress(current.progress);
        return result;
      },
      { connection: bullConnection(), concurrency: env.workerConcurrency },
    );
    bullWorker.on("failed", (job, error) => console.error("[clearframe] BullMQ job failed", job?.id, error));
    bullWorker.on("error", (error) => console.error("[clearframe] BullMQ worker error", error));
  } else {
    intervals.push(setInterval(() => void pollDatabaseQueue(), 1000));
    void pollDatabaseQueue();
  }

  await heartbeat();
  intervals.push(setInterval(() => void heartbeat(), env.workerHeartbeatSeconds * 1000));
  intervals.push(
    setInterval(() => {
      void cleanupWithLock().catch((error) => console.warn("[clearframe] Cleanup failed", error));
    }, cleanupIntervalMs()),
  );
  void cleanupWithLock().catch((error) => console.warn("[clearframe] Initial cleanup failed", error));
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[clearframe] Worker received ${signal}; shutting down`);
  for (const interval of intervals) clearInterval(interval);
  if (bullWorker) await bullWorker.close().catch(() => undefined);
  if (redisSubscriber) await redisSubscriber.quit().catch(() => undefined);
  await disconnectRedis().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => console.error("[clearframe] Unhandled worker rejection", error));

start().catch((error) => {
  console.error("[clearframe] Worker failed to start", error);
  process.exit(1);
});
