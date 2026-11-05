import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { OUTPUT_FORMAT_META, normalizeConversionSettings, type OutputFormat } from "@/lib/presets";
import { MediaValidationError } from "@/lib/signatures";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { sanitizeFilename } from "@/lib/security";
import { registerActiveJob, unregisterActiveJob } from "@/worker/active-jobs";
import { convertMediaFile } from "@/lib/media/ffmpeg";
import { probeMedia } from "@/lib/media/ffprobe";
import { hashFile } from "@/lib/hash-file";


class ProgressReporter {
  private latest = 0;
  private writing = false;
  private disposed = false;

  constructor(private jobId: string) {}

  report(progress: number, stage = "Encoding") {
    this.latest = Math.max(this.latest, Math.min(99, progress));
    void this.flush(stage);
  }

  async flush(stage = "Encoding") {
    if (this.writing || this.disposed) return;
    this.writing = true;
    const value = this.latest;
    try {
      await prisma.conversionJob.updateMany({
        where: { id: this.jobId, status: "PROCESSING" },
        data: { progress: value, stage },
      });
    } catch (error) {
      console.warn("[clearframe] Progress update failed", this.jobId, error);
    } finally {
      this.writing = false;
      if (!this.disposed && this.latest > value) void this.flush(stage);
    }
  }

  async set(progress: number, stage: string) {
    this.latest = progress;
    await prisma.conversionJob.updateMany({
      where: { id: this.jobId, status: "PROCESSING" },
      data: { progress, stage },
    });
  }

  dispose() {
    this.disposed = true;
  }
}

async function event(jobId: string, level: "INFO" | "WARN" | "ERROR", stage: string, message: string, progress?: number) {
  await prisma.processingEvent.create({
    data: { jobId, level, stage, message, progress: progress ?? null },
  });
}

function errorDetails(error: unknown) {
  if (error instanceof MediaValidationError) return { code: error.code, message: error.message };
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout/i.test(message)) return { code: "FFMPEG_TIMEOUT", message };
  if (/canceled/i.test(message)) return { code: "CANCELED", message: "The conversion was canceled." };
  if (/no such file|not found/i.test(message)) return { code: "SOURCE_UNAVAILABLE", message };
  return { code: "CONVERSION_FAILED", message };
}

function outputFilename(displayName: string, format: OutputFormat) {
  const base = sanitizeFilename(displayName).replace(/\.[a-z0-9]{1,8}$/i, "") || "converted-media";
  return sanitizeFilename(`${base}.${OUTPUT_FORMAT_META[format].extension}`);
}

export interface ProcessJobResult {
  ok: boolean;
  status?: string;
  error?: string;
}

export async function processConversionJob(jobId: string, workerId: string): Promise<ProcessJobResult> {
  const job = await prisma.conversionJob.findUnique({
    where: { id: jobId },
    include: { media: true },
  });
  if (!job || ["COMPLETED", "FAILED", "CANCELED"].includes(job.status)) {
    return { ok: false, status: job?.status || "NOT_FOUND", error: "Job is not eligible for processing." };
  }
  if (job.media.status !== "READY" || job.media.expiresAt <= new Date()) {
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        stage: "Source expired",
        errorCode: "SOURCE_EXPIRED",
        errorMessage: "The source media expired before conversion started.",
        completedAt: new Date(),
      },
    });
    await event(jobId, "ERROR", "Source expired", "The source media is no longer available.");
    return { ok: false, status: "FAILED", error: "SOURCE_EXPIRED" };
  }

  const claim = await prisma.conversionJob.updateMany({
    where: { id: jobId, status: { in: ["QUEUED", "PROCESSING"] } },
    data: {
      status: "PROCESSING",
      stage: "Preparing",
      startedAt: new Date(),
      workerId,
      attempts: { increment: 1 },
    },
  });
  if (!claim.count) return { ok: false, status: "NOT_CLAIMED", error: "Another worker claimed this job." };

  const storage = getStorage();
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "clearframe-job-"));
  const controller = new AbortController();
  const reporter = new ProgressReporter(jobId);
  registerActiveJob(jobId, controller);

  let cancellationTimer: NodeJS.Timeout | undefined;
  try {
    await event(jobId, "INFO", "Preparing", "Claimed by the media-processing worker.", 0);
    const sourceExtension = job.media.sourceKey.split(".").pop() || "media";
    const sourcePath = path.join(tempDirectory, `source.${sourceExtension.replace(/[^a-z0-9]/gi, "")}`);
    const outputFormat = job.targetFormat as OutputFormat;
    const outputMeta = OUTPUT_FORMAT_META[outputFormat];
    const outputPath = path.join(tempDirectory, `output.${outputMeta.extension}`);

    await storage.getObjectToFile(job.media.sourceKey, sourcePath);
    await event(jobId, "INFO", "Preparing", "Source object downloaded and metadata revalidated.", 0);

    const sourceProbe = await probeMedia(sourcePath);
    const capabilities = {
      kind: sourceProbe.kind,
      width: sourceProbe.width,
      height: sourceProbe.height,
      hasVideo: sourceProbe.hasVideo,
      hasAudio: sourceProbe.hasAudio,
      durationSeconds: sourceProbe.durationSeconds,
    };
    const settings = normalizeConversionSettings(capabilities, {
      targetFormat: outputFormat,
      videoPreset: (job.videoPreset || "source") as any,
      videoQuality: (job.videoQuality || "balanced") as any,
      audioBitrateKbps: job.audioBitrateKbps,
    });

    cancellationTimer = setInterval(() => {
      void prisma.conversionJob
        .findUnique({ where: { id: jobId }, select: { status: true } })
        .then((current) => {
          if (!current || current.status === "CANCELED") controller.abort();
        })
        .catch(() => undefined);
    }, 1500);

    const current = await prisma.conversionJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!current || current.status === "CANCELED") throw new Error("The media process was canceled.");

    await event(jobId, "INFO", "Encoding", `FFmpeg started for ${outputFormat} output.`, 0);
    await convertMediaFile({
      inputPath: sourcePath,
      outputPath,
      media: capabilities,
      settings,
      signal: controller.signal,
      onProgress: (progress) => reporter.report(progress),
    });
    await reporter.flush("Encoding");

    if (controller.signal.aborted) throw new Error("The media process was canceled.");
    await reporter.set(96, "Validating result");
    await event(jobId, "INFO", "Validating result", "Output signature and size were verified.", 96);

    const outputHash = await hashFile(outputPath);
    const outputInfo = await stat(outputPath);
    let outputDuration: number | null = null;
    try {
      outputDuration = (await probeMedia(outputPath)).durationSeconds;
    } catch {
      outputDuration = sourceProbe.durationSeconds;
      console.warn("[clearframe] Output probe metadata unavailable", jobId);
    }

    const objectKey = `${job.userId}/${jobId}/output.${outputMeta.extension}`;
    await reporter.set(98, "Storing result");
    await storage.putObject(objectKey, outputPath, outputMeta.mimeType);

    const fileName = outputFilename(job.media.displayName, outputFormat);
    await prisma.conversionOutput.create({
      data: {
        jobId,
        fileName,
        mimeType: outputMeta.mimeType,
        objectKey,
        sizeBytes: BigInt(outputInfo.size),
        sha256: outputHash,
        durationSeconds: outputDuration,
        expiresAt: new Date(Date.now() + env.retentionHours * 3600_000),
      },
    });

    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        stage: "Completed",
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    await event(jobId, "INFO", "Completed", `${fileName} is ready to download.`, 100);
    return { ok: true, status: "COMPLETED" };
  } catch (error) {
    const details = errorDetails(error);
    const canceled = details.code === "CANCELED" || controller.signal.aborted;
    if (canceled) {
      await prisma.conversionJob.updateMany({
        where: { id: jobId, status: "PROCESSING" },
        data: { status: "CANCELED", stage: "Canceled", canceledAt: new Date() },
      });
      await event(jobId, "WARN", "Canceled", "FFmpeg was terminated after the job was canceled.");
      return { ok: false, status: "CANCELED", error: "CANCELED" };
    }
    await prisma.conversionJob.updateMany({
      where: { id: jobId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        stage: "Failed",
        errorCode: details.code,
        errorMessage: details.message.slice(0, 600),
        completedAt: new Date(),
      },
    });
    await event(jobId, "ERROR", "Failed", details.message.slice(0, 600));
    console.error("[clearframe] Conversion failed", jobId, details);
    return { ok: false, status: "FAILED", error: details.code };
  } finally {
    if (cancellationTimer) clearInterval(cancellationTimer);
    reporter.dispose();
    unregisterActiveJob(jobId);
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
