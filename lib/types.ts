import type { AudioBitrate, OutputFormat, VideoPresetId, VideoQuality } from "@/lib/presets";

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED";
export type MediaKind = "VIDEO" | "AUDIO";
export type EventLevel = "INFO" | "WARN" | "ERROR";

export interface MediaDTO {
  id: string;
  displayName: string;
  mimeType: string;
  container: string;
  sizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  frameRate: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  kind: MediaKind;
  sha256: string;
  hasThumbnail: boolean;
  hasPreview: boolean;
  status: string;
  sourceDomain: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface OutputDTO {
  id: string;
  jobId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  durationSeconds: number | null;
  downloadCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface EventDTO {
  id: string;
  level: EventLevel;
  stage: string;
  message: string;
  progress: number | null;
  createdAt: string;
}

export interface JobDTO {
  id: string;
  batchId: string;
  mediaId: string;
  media: Pick<MediaDTO, "id" | "displayName" | "kind" | "durationSeconds" | "hasThumbnail"> | null;
  targetFormat: OutputFormat;
  presetLabel: string;
  videoHeight: number | null;
  videoBitrateKbps: number | null;
  audioBitrateKbps: number | null;
  status: JobStatus;
  progress: number;
  stage: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  workerId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  outputs: OutputDTO[];
  events: EventDTO[];
}

export interface BatchDTO {
  id: string;
  createdAt: string;
  aggregateProgress: number;
  status: JobStatus | "MIXED";
  counts: Record<JobStatus, number>;
  jobs: JobDTO[];
}

export interface CreateJobInput {
  mediaId: string;
  targetFormat: OutputFormat;
  videoPreset?: VideoPresetId;
  videoQuality?: VideoQuality;
  audioBitrateKbps?: AudioBitrate | null;
}

export interface PublicConfig {
  appName: string;
  maxUploadBytes: number;
  maxBatchFiles: number;
  maxDurationSeconds: number;
  retentionHours: number;
  storageDriver: "s3" | "filesystem";
  videoFormats: string[];
  audioFormats: string[];
}
