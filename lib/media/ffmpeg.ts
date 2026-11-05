import { open, stat } from "node:fs/promises";
import { OUTPUT_FORMAT_META, evenDown, type MediaCapabilities, type NormalizedConversionSettings } from "@/lib/presets";
import { validateOutputSignature } from "@/lib/signatures";
import { env } from "@/lib/env";
import { runFfmpeg } from "@/lib/media/process";

const OUTPUT_SCALE = (width: number, height: number) => `scale=${width}:${height}:flags=lanczos,setsar=1`;

export function buildFfmpegArgs(options: {
  inputPath: string;
  outputPath: string;
  media: MediaCapabilities;
  settings: NormalizedConversionSettings;
}) {
  const { inputPath, outputPath, media, settings } = options;
  const meta = OUTPUT_FORMAT_META[settings.targetFormat];
  const args = [
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-y",
    "-i",
    inputPath,
    "-map_metadata",
    "-1",
    "-sn",
    "-dn",
    "-threads",
    "2",
    "-max_muxing_queue_size",
    "1024",
  ];

  if (meta.family === "audio") {
    args.push("-map", "0:a:0", "-vn");
    const bitrate = settings.audioBitrateKbps || 192;
    switch (settings.targetFormat) {
      case "MP3":
        args.push("-c:a", "libmp3lame", "-b:a", `${bitrate}k`);
        break;
      case "WAV":
        args.push("-c:a", "pcm_s16le");
        break;
      case "AAC":
        args.push("-c:a", "aac", "-b:a", `${bitrate}k`, "-f", "adts");
        break;
      case "FLAC":
        args.push("-c:a", "flac", "-compression_level", "5");
        break;
    }
  } else {
    const sourceWidth = media.width || 16;
    const sourceHeight = media.height || 9;
    const targetHeight = evenDown(settings.videoHeight || sourceHeight);
    const targetWidth = evenDown(Math.round(targetHeight * (sourceWidth / sourceHeight)));
    args.push("-map", "0:v:0", "-vf", OUTPUT_SCALE(targetWidth, targetHeight));
    const bitrate = settings.videoBitrateKbps || 2500;
    const audioBitrate = settings.audioBitrateKbps || 192;

    if (settings.targetFormat === "MP4") {
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-b:v",
        `${bitrate}k`,
        "-maxrate",
        `${Math.round(bitrate * 1.25)}k`,
        "-bufsize",
        `${Math.round(bitrate * 2)}k`,
        "-movflags",
        "+faststart",
      );
      if (media.hasAudio) args.push("-map", "0:a:0?", "-c:a", "aac", "-b:a", `${audioBitrate}k`);
      else args.push("-an");
    } else {
      args.push(
        "-c:v",
        "libvpx-vp9",
        "-pix_fmt",
        "yuv420p",
        "-b:v",
        `${bitrate}k`,
        "-row-mt",
        "1",
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        "-f",
        "webm",
      );
      if (media.hasAudio) args.push("-map", "0:a:0?", "-c:a", "libopus", "-b:a", `${Math.min(audioBitrate, 192)}k`);
      else args.push("-an");
    }
  }

  args.push("-metadata", "comment=Converted by Clearframe from authorized media", outputPath);
  return args;
}

export function parseFfmpegProgress(line: string, durationSeconds: number | null) {
  const match = /^(?:out_time_ms|out_time_us)=(-?\d+)/.exec(line.trim());
  if (!match || !durationSeconds || durationSeconds <= 0) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw) || raw < 0) return null;
  // FFmpeg's `out_time_ms` key is microseconds for backward compatibility; `out_time_us` uses the same unit.
  const unit = 1_000_000;
  const seconds = raw / unit;
  return Math.max(0, Math.min(95, Math.round((seconds / durationSeconds) * 9500) / 100));
}

export interface ConversionResult {
  sizeBytes: number;
  format: string;
}

export async function convertMediaFile(options: {
  inputPath: string;
  outputPath: string;
  media: MediaCapabilities;
  settings: NormalizedConversionSettings;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}): Promise<ConversionResult> {
  const args = buildFfmpegArgs(options);
  let lastReported = 0;
  await runFfmpeg(args, {
    timeoutMs: env.ffmpegTimeoutMs,
    signal: options.signal,
    onLine: (line) => {
      const progress = parseFfmpegProgress(line, options.media.durationSeconds ?? null);
      if (progress !== null && progress > lastReported + 0.75) {
        lastReported = progress;
        options.onProgress?.(progress);
      }
    },
  });

  const handle = await open(options.outputPath, "r");
  const head = Buffer.alloc(512);
  const { bytesRead } = await handle.read(head, 0, head.length, 0);
  await handle.close();
  validateOutputSignature(options.settings.targetFormat, head.subarray(0, bytesRead));

  const info = await stat(options.outputPath);
  if (info.size <= 0) throw new Error("FFmpeg produced an empty output file.");
  return { sizeBytes: info.size, format: options.settings.targetFormat };
}
