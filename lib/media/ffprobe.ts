import { stat } from "node:fs/promises";
import { env } from "@/lib/env";
import { MediaValidationError } from "@/lib/signatures";
import { runFfprobe } from "@/lib/media/process";

export interface MediaProbe {
  sizeBytes: number;
  durationSeconds: number;
  width: number | null;
  height: number | null;
  frameRate: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  kind: "VIDEO" | "AUDIO";
  bitrateKbps: number | null;
}

interface RawStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  avg_frame_rate?: string;
  disposition?: { attached_pic?: number };
}

function finiteNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const info = await stat(filePath);
  const { stdout } = await runFfprobe(
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    env.ffprobeTimeoutMs,
  );

  let parsed: { format?: Record<string, unknown>; streams?: RawStream[] };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new MediaValidationError("FFprobe could not read the media metadata.", "PROBE_FAILED");
  }

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  if (streams.length === 0 || streams.length > 24) {
    throw new MediaValidationError("The file has an unsupported stream layout.", "UNSUPPORTED_STREAMS");
  }
  const video = streams.find(
    (stream) => stream.codec_type === "video" && !stream.disposition?.attached_pic,
  );
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const formatDuration = finiteNumber(parsed.format?.duration);
  const streamDuration = finiteNumber(video?.duration || audio?.duration);
  const durationSeconds = formatDuration || streamDuration;

  if (!durationSeconds || durationSeconds <= 0 || durationSeconds > env.maxDurationSeconds) {
    throw new MediaValidationError(
      `Media duration must be between 0 and ${Math.round(env.maxDurationSeconds / 60)} minutes.`,
      "DURATION_LIMIT",
    );
  }

  const width = video ? finiteNumber(video.width) : null;
  const height = video ? finiteNumber(video.height) : null;
  if (video && (!width || !height)) {
    throw new MediaValidationError("The video stream has invalid dimensions.", "INVALID_DIMENSIONS");
  }
  if (width && height && width * height > env.maxVideoPixels) {
    throw new MediaValidationError("The video resolution exceeds the configured processing limit.", "PIXEL_LIMIT");
  }
  if (!video && !audio) {
    throw new MediaValidationError("No decodable video or audio stream was found.", "NO_MEDIA_STREAM");
  }

  const bitrate = finiteNumber(parsed.format?.bit_rate);
  return {
    sizeBytes: info.size,
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    width,
    height,
    frameRate: video?.avg_frame_rate && video.avg_frame_rate !== "0/0" ? video.avg_frame_rate.slice(0, 32) : null,
    videoCodec: video?.codec_name?.slice(0, 48) || null,
    audioCodec: audio?.codec_name?.slice(0, 48) || null,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    kind: video ? "VIDEO" : "AUDIO",
    bitrateKbps: bitrate ? Math.round(bitrate / 1000) : null,
  };
}
