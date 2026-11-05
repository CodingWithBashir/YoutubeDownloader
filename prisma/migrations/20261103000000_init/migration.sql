-- CreateEnum
CREATE TYPE "PrincipalKind" AS ENUM ('GUEST', 'SERVICE');
CREATE TYPE "MediaKind" AS ENUM ('VIDEO', 'AUDIO');
CREATE TYPE "MediaStatus" AS ENUM ('READY', 'EXPIRED', 'FAILED');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED');
CREATE TYPE "OutputFormat" AS ENUM ('MP4', 'WEBM', 'MP3', 'WAV', 'AAC', 'FLAC');
CREATE TYPE "EventLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guestId" TEXT NOT NULL,
    "kind" "PrincipalKind" NOT NULL DEFAULT 'GUEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaFile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "container" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "frameRate" TEXT,
    "videoCodec" TEXT,
    "audioCodec" TEXT,
    "hasVideo" BOOLEAN NOT NULL DEFAULT false,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "kind" "MediaKind" NOT NULL,
    "sha256" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "thumbnailMime" TEXT,
    "previewKey" TEXT,
    "previewMime" TEXT,
    "sourceDomain" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'READY',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversionJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "targetFormat" "OutputFormat" NOT NULL,
    "presetLabel" TEXT NOT NULL,
    "videoPreset" TEXT,
    "videoQuality" TEXT,
    "videoHeight" INTEGER,
    "videoBitrateKbps" INTEGER,
    "audioBitrateKbps" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stage" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "queueJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversionOutput" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jobId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversionOutput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessingEvent" (
    "id" BIGSERIAL NOT NULL,
    "jobId" UUID NOT NULL,
    "level" "EventLevel" NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "progress" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_guestId_key" ON "User"("guestId");
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");
CREATE UNIQUE INDEX "MediaFile_sourceKey_key" ON "MediaFile"("sourceKey");
CREATE INDEX "MediaFile_userId_createdAt_idx" ON "MediaFile"("userId", "createdAt" DESC);
CREATE INDEX "MediaFile_status_expiresAt_idx" ON "MediaFile"("status", "expiresAt");
CREATE INDEX "MediaFile_expiresAt_idx" ON "MediaFile"("expiresAt");
CREATE UNIQUE INDEX "ConversionJob_queueJobId_key" ON "ConversionJob"("queueJobId");
CREATE INDEX "ConversionJob_userId_createdAt_idx" ON "ConversionJob"("userId", "createdAt" DESC);
CREATE INDEX "ConversionJob_batchId_idx" ON "ConversionJob"("batchId");
CREATE INDEX "ConversionJob_status_createdAt_idx" ON "ConversionJob"("status", "createdAt");
CREATE INDEX "ConversionJob_mediaId_idx" ON "ConversionJob"("mediaId");
CREATE UNIQUE INDEX "ConversionOutput_objectKey_key" ON "ConversionOutput"("objectKey");
CREATE INDEX "ConversionOutput_jobId_idx" ON "ConversionOutput"("jobId");
CREATE INDEX "ConversionOutput_expiresAt_idx" ON "ConversionOutput"("expiresAt");
CREATE INDEX "ProcessingEvent_jobId_createdAt_idx" ON "ProcessingEvent"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionJob" ADD CONSTRAINT "ConversionJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionJob" ADD CONSTRAINT "ConversionJob_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversionOutput" ADD CONSTRAINT "ConversionOutput_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConversionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingEvent" ADD CONSTRAINT "ProcessingEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConversionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
