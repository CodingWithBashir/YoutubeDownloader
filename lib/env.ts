import { z } from "zod";

function numberEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? Math.floor(parsed) : fallback;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get redisUrl() {
    return required("REDIS_URL");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get adminToken() {
    return process.env.ADMIN_TOKEN || "";
  },
  get appOrigin() {
    return process.env.APP_ORIGIN || "";
  },
  get storageDriver() {
    return z.enum(["s3", "filesystem"]).catch("filesystem").parse(process.env.STORAGE_DRIVER);
  },
  get s3() {
    return {
      endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
      region: process.env.S3_REGION || "us-east-1",
      bucket: process.env.S3_BUCKET || "clearframe",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || "true") === "true",
    };
  },
  get localStorageRoot() {
    return process.env.LOCAL_STORAGE_ROOT || "./storage";
  },
  get queueName() {
    return process.env.CONVERSION_QUEUE_NAME || "conversion";
  },
  get ffmpegPath() {
    return process.env.FFMPEG_PATH || "";
  },
  get ffprobePath() {
    return process.env.FFPROBE_PATH || "";
  },
  get maxUploadBytes() {
    return numberEnv("MAX_UPLOAD_BYTES", 262_144_000, 1024, 2_147_483_648);
  },
  get maxImportBytes() {
    return numberEnv("MAX_IMPORT_BYTES", 262_144_000, 1024, 2_147_483_648);
  },
  get maxBatchFiles() {
    return numberEnv("MAX_BATCH_FILES", 8, 1, 32);
  },
  get maxDurationSeconds() {
    return numberEnv("MAX_MEDIA_DURATION_SECONDS", 7200, 1, 43_200);
  },
  get maxVideoPixels() {
    return numberEnv("MAX_VIDEO_PIXELS", 33_177_600, 10_000, 200_000_000);
  },
  get ffprobeTimeoutMs() {
    return numberEnv("FFPROBE_TIMEOUT_MS", 20_000, 1000, 120_000);
  },
  get ffmpegTimeoutMs() {
    return numberEnv("FFMPEG_TIMEOUT_MS", 3_600_000, 10_000, 14_400_000);
  },
  get retentionHours() {
    return numberEnv("RETENTION_HOURS", 24, 1, 720);
  },
  get downloadTtlSeconds() {
    return numberEnv("DOWNLOAD_URL_TTL_SECONDS", 300, 30, 3600);
  },
  get workerConcurrency() {
    return numberEnv("WORKER_CONCURRENCY", 2, 1, 16);
  },
  get workerHeartbeatSeconds() {
    return numberEnv("WORKER_HEARTBEAT_SECONDS", 10, 2, 120);
  },
  get rateLimitWindowSeconds() {
    return numberEnv("RATE_LIMIT_WINDOW_SECONDS", 60, 5, 3600);
  },
  get rateLimitUploads() {
    return numberEnv("RATE_LIMIT_UPLOADS_PER_WINDOW", 12, 1, 10_000);
  },
  get rateLimitImports() {
    return numberEnv("RATE_LIMIT_IMPORTS_PER_WINDOW", 8, 1, 10_000);
  },
  get rateLimitJobs() {
    return numberEnv("RATE_LIMIT_JOBS_PER_WINDOW", 30, 1, 10_000);
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

export function publicConfig() {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Clearframe",
    maxUploadBytes: env.maxUploadBytes,
    maxBatchFiles: env.maxBatchFiles,
    maxDurationSeconds: env.maxDurationSeconds,
    retentionHours: env.retentionHours,
    storageDriver: env.storageDriver,
    videoFormats: ["MP4", "WEBM"],
    audioFormats: ["MP3", "WAV", "AAC", "FLAC"],
  };
}
