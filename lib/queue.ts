import { Queue, type ConnectionOptions } from "bullmq";
import { ensureRedis, getRedis, hasRedis } from "@/lib/redis";
import { env } from "@/lib/env";

export interface ConversionQueuePayload {
  jobId: string;
  userId: string;
  mediaId: string;
}

export interface ConversionQueueResult {
  ok: boolean;
  status?: string;
  error?: string;
}

type ConversionQueue = Queue<
  ConversionQueuePayload,
  ConversionQueueResult,
  "convert",
  ConversionQueuePayload,
  ConversionQueueResult,
  "convert"
>;

export const JOB_CANCEL_CHANNEL = "clearframe:job-cancel";

const globalForQueue = globalThis as unknown as {
  clearframeQueue?: ConversionQueue;
};

export function queueMode() {
  return hasRedis() ? "bullmq" : "database-poller";
}

export function bullConnection() {
  return getRedis() as unknown as ConnectionOptions;
}

export function getConversionQueue(): ConversionQueue {
  if (!hasRedis()) throw new Error("BullMQ is unavailable without REDIS_URL.");
  if (!globalForQueue.clearframeQueue) {
    const queue = new Queue<
      ConversionQueuePayload,
      ConversionQueueResult,
      "convert",
      ConversionQueuePayload,
      ConversionQueueResult,
      "convert"
    >(env.queueName, {
      connection: bullConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 1000 },
        backoff: { type: "fixed", delay: 1000 },
      },
    });
    globalForQueue.clearframeQueue = queue;
  }
  return globalForQueue.clearframeQueue;
}

export async function enqueueConversionJobs(payloads: ConversionQueuePayload[]) {
  if (!hasRedis()) return { mode: "database-poller" as const, enqueued: 0 };
  await ensureRedis();
  const queue = getConversionQueue();
  await queue.addBulk(
    payloads.map((payload) => ({
      name: "convert" as const,
      data: payload,
      opts: { jobId: payload.jobId },
    })),
  );
  return { mode: "bullmq" as const, enqueued: payloads.length };
}

export async function removeQueuedJob(jobId: string) {
  if (!hasRedis()) return;
  try {
    const queue = getConversionQueue();
    const job = await queue.getJob(jobId);
    if (job) await job.remove();
  } catch (error) {
    console.warn("[clearframe] Could not remove queued job", jobId, error);
  }
}

export async function publishJobCancel(jobId: string) {
  if (!hasRedis()) return;
  try {
    const redis = await ensureRedis();
    await redis.publish(JOB_CANCEL_CHANNEL, jobId);
  } catch (error) {
    console.warn("[clearframe] Could not publish cancellation", jobId, error);
  }
}

export async function getQueueMetrics() {
  if (!hasRedis()) return null;
  try {
    await ensureRedis();
    const queue = getConversionQueue();
    return await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
  } catch {
    return null;
  }
}
