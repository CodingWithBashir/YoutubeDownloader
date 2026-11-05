import { randomUUID } from "node:crypto";
import {
  AUDIO_BITRATE_VALUES,
  OUTPUT_FORMAT_VALUES,
  VIDEO_PRESET_VALUES,
  VIDEO_QUALITY_VALUES,
  ConversionValidationError,
  normalizeConversionSettings,
  type AudioBitrate,
  type OutputFormat,
  type VideoPresetId,
  type VideoQuality,
} from "@/lib/presets";
import { badRequest, conflict, notFound, serviceUnavailable } from "@/lib/errors";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { enqueueConversionJobs, publishJobCancel, removeQueuedJob } from "@/lib/queue";
import { serializeBatch, serializeJob, serializeMedia } from "@/lib/serializers";
import type { CreateJobInput, JobDTO, JobStatus, MediaDTO } from "@/lib/types";
import { historyQuerySchema } from "@/lib/validation";

const jobInclude = {
  media: {
    select: {
      id: true,
      displayName: true,
      kind: true,
      durationSeconds: true,
      thumbnailKey: true,
    },
  },
  outputs: { orderBy: { createdAt: "desc" as const } },
  events: { orderBy: { createdAt: "asc" as const }, take: 50 },
} as const;

function capabilities(media: any) {
  return {
    kind: media.kind as "VIDEO" | "AUDIO",
    width: media.width,
    height: media.height,
    hasVideo: Boolean(media.hasVideo),
    hasAudio: Boolean(media.hasAudio),
    durationSeconds: media.durationSeconds,
  };
}

export async function createConversionJobs(userId: string, items: CreateJobInput[]) {
  if (items.length > env.maxBatchFiles) {
    throw badRequest(`A batch may contain at most ${env.maxBatchFiles} conversions.`);
  }
  const mediaIds = [...new Set(items.map((item) => item.mediaId))];
  const mediaRecords = await prisma.mediaFile.findMany({
    where: {
      id: { in: mediaIds },
      userId,
      status: "READY",
      expiresAt: { gt: new Date() },
    },
  });
  const mediaById = new Map(mediaRecords.map((record: any) => [record.id, record]));

  const prepared = items.map((item) => {
    const media = mediaById.get(item.mediaId);
    if (!media) throw notFound("One or more selected files are no longer available.");
    if (!OUTPUT_FORMAT_VALUES.includes(item.targetFormat)) {
      throw badRequest("The requested output format is not supported.");
    }
    try {
      const settings = normalizeConversionSettings(capabilities(media), {
        targetFormat: item.targetFormat,
        videoPreset: item.videoPreset,
        videoQuality: item.videoQuality,
        audioBitrateKbps: item.audioBitrateKbps,
      });
      return { item, media, settings };
    } catch (error) {
      if (error instanceof ConversionValidationError) throw badRequest(error.message);
      throw error;
    }
  });

  const batchId = randomUUID();
  const createdIds = await prisma.$transaction(async (tx: any) => {
    const ids: string[] = [];
    for (const { media, settings } of prepared) {
      const jobId = randomUUID();
      const job = await tx.conversionJob.create({
        data: {
          id: jobId,
          userId,
          mediaId: media.id,
          batchId,
          targetFormat: settings.targetFormat,
          presetLabel: settings.presetLabel,
          videoPreset: settings.videoPreset,
          videoQuality: settings.videoQuality,
          videoHeight: settings.videoHeight,
          videoBitrateKbps: settings.videoBitrateKbps,
          audioBitrateKbps: settings.audioBitrateKbps,
          status: "QUEUED",
          progress: 0,
          stage: "Queued",
          queueJobId: jobId,
          attempts: 0,
        },
        select: { id: true },
      });
      ids.push(job.id);
      await tx.processingEvent.create({
        data: {
          jobId: job.id,
          level: "INFO",
          stage: "Queued",
          message: `Conversion to ${settings.targetFormat} accepted (${settings.presetLabel}).`,
          progress: 0,
        },
      });
    }
    return ids;
  });

  try {
    const enqueueResult = await enqueueConversionJobs(
      createdIds.map((id, index) => ({
        jobId: id,
        userId,
        mediaId: prepared[index].item.mediaId,
      })),
    );
    void enqueueResult;
  } catch (error) {
    console.error("[clearframe] Failed to enqueue jobs", error);
    await prisma.$transaction(async (tx: any) => {
      await tx.conversionJob.updateMany({
        where: { id: { in: createdIds } },
        data: {
          status: "FAILED",
          stage: "Queue unavailable",
          errorCode: "QUEUE_UNAVAILABLE",
          errorMessage: "The background queue could not accept this batch.",
          completedAt: new Date(),
        },
      });
      await tx.processingEvent.createMany({
        data: createdIds.map((id) => ({
          jobId: id,
          level: "ERROR" as const,
          stage: "Queue unavailable",
          message: "Redis/BullMQ did not accept the job. No conversion was performed.",
          progress: 0,
        })),
      });
    });
    throw serviceUnavailable("The conversion queue is unavailable. No jobs were marked as complete.");
  }

  const jobs = await prisma.conversionJob.findMany({
    where: { id: { in: createdIds }, userId },
    include: jobInclude,
  });
  return { batchId, jobs: jobs.map(serializeJob) as JobDTO[] };
}

export async function getBatch(userId: string, batchId: string) {
  const jobs = await prisma.conversionJob.findMany({
    where: { batchId, userId },
    include: jobInclude,
    orderBy: { createdAt: "asc" },
  });
  if (!jobs.length) throw notFound("This conversion batch was not found.");
  return serializeBatch(jobs);
}

export async function getJob(userId: string, jobId: string) {
  const job = await prisma.conversionJob.findFirst({
    where: { id: jobId, userId },
    include: jobInclude,
  });
  if (!job) throw notFound("This conversion job was not found.");
  return serializeJob(job);
}

export async function cancelJob(userId: string, jobId: string) {
  const result = await prisma.conversionJob.updateMany({
    where: { id: jobId, userId, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "CANCELED", stage: "Canceled", canceledAt: new Date() },
  });
  if (result.count === 0) {
    const existing = await prisma.conversionJob.findFirst({ where: { id: jobId, userId }, select: { status: true } });
    if (!existing) throw notFound("This conversion job was not found.");
    throw conflict("Only queued or processing jobs can be canceled.");
  }
  await prisma.processingEvent.create({
    data: {
      jobId,
      level: "WARN",
      stage: "Canceled",
      message: "The job was canceled by its owner.",
    },
  });
  await removeQueuedJob(jobId);
  await publishJobCancel(jobId);
  return getJob(userId, jobId);
}

export async function retryJob(userId: string, jobId: string) {
  const job = await prisma.conversionJob.findFirst({
    where: { id: jobId, userId },
    include: { media: true },
  });
  if (!job) throw notFound("This conversion job was not found.");
  if (!["FAILED", "CANCELED"].includes(job.status)) {
    throw conflict("Only failed or canceled jobs can be retried.");
  }
  if (job.media.status !== "READY" || job.media.expiresAt <= new Date()) {
    throw conflict("The source file has expired. Upload it again to retry.");
  }
  const videoPreset = VIDEO_PRESET_VALUES.includes(job.videoPreset as VideoPresetId)
    ? (job.videoPreset as VideoPresetId)
    : undefined;
  const videoQuality = VIDEO_QUALITY_VALUES.includes(job.videoQuality as VideoQuality)
    ? (job.videoQuality as VideoQuality)
    : undefined;
  const audioBitrateKbps = AUDIO_BITRATE_VALUES.includes(job.audioBitrateKbps as AudioBitrate)
    ? (job.audioBitrateKbps as AudioBitrate)
    : null;
  return createConversionJobs(userId, [
    {
      mediaId: job.mediaId,
      targetFormat: job.targetFormat as OutputFormat,
      videoPreset,
      videoQuality,
      audioBitrateKbps,
    },
  ]);
}

export async function listHistory(userId: string, rawQuery: Record<string, string | null>) {
  const query = historyQuerySchema.parse({
    q: rawQuery.q || undefined,
    status: rawQuery.status || undefined,
    page: rawQuery.page || 1,
    limit: rawQuery.limit || 12,
  });
  const where: any = { userId };
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { media: { displayName: { contains: query.q, mode: "insensitive" } } },
      { presetLabel: { contains: query.q, mode: "insensitive" } },
    ];
  }
  const [total, jobs] = await Promise.all([
    prisma.conversionJob.count({ where }),
    prisma.conversionJob.findMany({
      where,
      include: jobInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return {
    jobs: jobs.map(serializeJob) as JobDTO[],
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getMediaByIds(userId: string, ids: string[]) {
  const records = await prisma.mediaFile.findMany({
    where: { id: { in: ids }, userId, status: "READY", expiresAt: { gt: new Date() } },
  });
  const byId = new Map(records.map((record: any) => [record.id, serializeMedia(record)]));
  return ids.map((id) => byId.get(id)).filter((item): item is MediaDTO => Boolean(item));
}

export async function deleteMedia(userId: string, mediaId: string) {
  const active = await prisma.conversionJob.count({
    where: { mediaId, userId, status: { in: ["QUEUED", "PROCESSING"] } },
  });
  if (active) throw conflict("Cancel active conversions before removing this file.");
  const result = await prisma.mediaFile.updateMany({
    where: { id: mediaId, userId, status: "READY" },
    data: { status: "EXPIRED", expiresAt: new Date() },
  });
  if (!result.count) throw notFound("This media file was not found.");
  return { success: true };
}

export async function getGuestStats(userId: string) {
  const [totalJobs, activeJobs, completedJobs, failedJobs, mediaCount, expiringSoon, outputs, recentJobs] =
    await Promise.all([
      prisma.conversionJob.count({ where: { userId } }),
      prisma.conversionJob.count({ where: { userId, status: { in: ["QUEUED", "PROCESSING"] } } }),
      prisma.conversionJob.count({ where: { userId, status: "COMPLETED" } }),
      prisma.conversionJob.count({ where: { userId, status: "FAILED" } }),
      prisma.mediaFile.count({ where: { userId, status: "READY" } }),
      prisma.mediaFile.count({
        where: { userId, status: "READY", expiresAt: { lte: new Date(Date.now() + 6 * 3600_000) } },
      }),
      prisma.conversionOutput.findMany({
        where: { job: { userId } },
        select: { sizeBytes: true },
      }),
      prisma.conversionJob.findMany({
        where: { userId },
        include: jobInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
  const storedBytes = outputs.reduce((sum: number, output: any) => sum + Number(output.sizeBytes || 0), 0);
  return {
    counts: { totalJobs, activeJobs, completedJobs, failedJobs, mediaCount, expiringSoon },
    storedBytes,
    recentJobs: recentJobs.map(serializeJob) as JobDTO[],
    retentionHours: env.retentionHours,
  };
}

export function isTerminalStatus(status: JobStatus) {
  return ["COMPLETED", "FAILED", "CANCELED"].includes(status);
}
