import type { BatchDTO, EventDTO, JobDTO, JobStatus, MediaDTO, OutputDTO } from "@/lib/types";

const iso = (value: Date | string | null | undefined) =>
  value ? (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) : null;

const numberFrom = (value: bigint | number | null | undefined) => (value === null || value === undefined ? 0 : Number(value));

export function serializeMedia(record: any): MediaDTO {
  return {
    id: record.id,
    displayName: record.displayName,
    mimeType: record.mimeType,
    container: record.container,
    sizeBytes: numberFrom(record.sizeBytes),
    durationSeconds: record.durationSeconds ?? null,
    width: record.width ?? null,
    height: record.height ?? null,
    videoCodec: record.videoCodec ?? null,
    audioCodec: record.audioCodec ?? null,
    hasVideo: Boolean(record.hasVideo),
    hasAudio: Boolean(record.hasAudio),
    kind: record.kind,
    sha256: record.sha256,
    frameRate: record.frameRate ?? null,
    hasThumbnail: Boolean(record.thumbnailKey),
    hasPreview: Boolean(record.previewKey),
    status: record.status,
    sourceDomain: record.sourceDomain ?? null,
    createdAt: iso(record.createdAt)!,
    expiresAt: iso(record.expiresAt)!,
  };
}

export function serializeOutput(record: any): OutputDTO {
  return {
    id: record.id,
    jobId: record.jobId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: numberFrom(record.sizeBytes),
    sha256: record.sha256,
    durationSeconds: record.durationSeconds ?? null,
    downloadCount: record.downloadCount ?? 0,
    createdAt: iso(record.createdAt)!,
    expiresAt: iso(record.expiresAt)!,
  };
}

export function serializeEvent(record: any): EventDTO {
  return {
    id: String(record.id),
    level: record.level,
    stage: record.stage,
    message: record.message,
    progress: record.progress ?? null,
    createdAt: iso(record.createdAt)!,
  };
}

export function serializeJob(record: any): JobDTO {
  return {
    id: record.id,
    batchId: record.batchId,
    mediaId: record.mediaId,
    media: record.media
      ? {
          id: record.media.id,
          displayName: record.media.displayName,
          kind: record.media.kind,
          durationSeconds: record.media.durationSeconds ?? null,
          hasThumbnail: Boolean(record.media.thumbnailKey),
        }
      : null,
    targetFormat: record.targetFormat,
    presetLabel: record.presetLabel,
    videoHeight: record.videoHeight ?? null,
    videoBitrateKbps: record.videoBitrateKbps ?? null,
    audioBitrateKbps: record.audioBitrateKbps ?? null,
    status: record.status,
    progress: record.progress ?? 0,
    stage: record.stage ?? null,
    errorCode: record.errorCode ?? null,
    errorMessage: record.errorMessage ?? null,
    attempts: record.attempts ?? 0,
    workerId: record.workerId ?? null,
    createdAt: iso(record.createdAt)!,
    updatedAt: iso(record.updatedAt)!,
    startedAt: iso(record.startedAt),
    completedAt: iso(record.completedAt),
    outputs: Array.isArray(record.outputs) ? record.outputs.map(serializeOutput) : [],
    events: Array.isArray(record.events)
      ? [...record.events]
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map(serializeEvent)
      : [],
  };
}

export function serializeBatch(records: any[]): BatchDTO {
  const jobs = records.map(serializeJob);
  const counts: Record<JobStatus, number> = {
    QUEUED: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELED: 0,
  };
  for (const job of jobs) counts[job.status] += 1;
  const statuses = new Set(jobs.map((job) => job.status));
  let status: BatchDTO["status"] = "MIXED";
  if (statuses.size === 1) status = jobs[0]?.status || "MIXED";
  const aggregateProgress = jobs.length
    ? Math.round((jobs.reduce((sum, job) => sum + job.progress, 0) / jobs.length) * 10) / 10
    : 0;
  return {
    id: records[0]?.batchId || "",
    createdAt: jobs.map((job) => job.createdAt).sort()[0] || new Date().toISOString(),
    aggregateProgress,
    status,
    counts,
    jobs: jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}
