export const OUTPUT_FORMAT_VALUES = ["MP4", "WEBM", "MP3", "WAV", "AAC", "FLAC"] as const;
export type OutputFormat = (typeof OUTPUT_FORMAT_VALUES)[number];

export const VIDEO_PRESET_VALUES = ["source", "2160p", "1440p", "1080p", "720p", "480p", "360p"] as const;
export type VideoPresetId = (typeof VIDEO_PRESET_VALUES)[number];

export const VIDEO_QUALITY_VALUES = ["efficient", "balanced", "high"] as const;
export type VideoQuality = (typeof VIDEO_QUALITY_VALUES)[number];

export const AUDIO_BITRATE_VALUES = [128, 192, 256, 320] as const;
export type AudioBitrate = (typeof AUDIO_BITRATE_VALUES)[number];

export const OUTPUT_FORMAT_META: Record<
  OutputFormat,
  { label: string; mimeType: string; extension: string; family: "video" | "audio"; description: string }
> = {
  MP4: { label: "MP4", mimeType: "video/mp4", extension: "mp4", family: "video", description: "H.264 + AAC · universal compatibility" },
  WEBM: { label: "WebM", mimeType: "video/webm", extension: "webm", family: "video", description: "VP9 + Opus · optimized for the web" },
  MP3: { label: "MP3", mimeType: "audio/mpeg", extension: "mp3", family: "audio", description: "Broadest device support" },
  WAV: { label: "WAV", mimeType: "audio/wav", extension: "wav", family: "audio", description: "Uncompressed PCM audio" },
  AAC: { label: "AAC", mimeType: "audio/aac", extension: "aac", family: "audio", description: "Efficient compressed audio" },
  FLAC: { label: "FLAC", mimeType: "audio/flac", extension: "flac", family: "audio", description: "Lossless compressed audio" },
};

export const VIDEO_PRESETS: Array<{
  id: VideoPresetId;
  label: string;
  height: number | null;
  baseBitrateKbps: number | null;
}> = [
  { id: "source", label: "Original resolution", height: null, baseBitrateKbps: null },
  { id: "2160p", label: "4K · 2160p", height: 2160, baseBitrateKbps: 14000 },
  { id: "1440p", label: "QHD · 1440p", height: 1440, baseBitrateKbps: 8000 },
  { id: "1080p", label: "Full HD · 1080p", height: 1080, baseBitrateKbps: 4500 },
  { id: "720p", label: "HD · 720p", height: 720, baseBitrateKbps: 2500 },
  { id: "480p", label: "SD · 480p", height: 480, baseBitrateKbps: 1200 },
  { id: "360p", label: "Compact · 360p", height: 360, baseBitrateKbps: 700 },
];

export const VIDEO_QUALITIES: Array<{ id: VideoQuality; label: string; multiplier: number; note: string }> = [
  { id: "efficient", label: "Efficient", multiplier: 0.68, note: "Smaller files" },
  { id: "balanced", label: "Balanced", multiplier: 1, note: "Recommended" },
  { id: "high", label: "High quality", multiplier: 1.45, note: "Larger files" },
];

export interface MediaCapabilities {
  kind: "VIDEO" | "AUDIO";
  width?: number | null;
  height?: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  durationSeconds?: number | null;
}

export interface NormalizedConversionSettings {
  targetFormat: OutputFormat;
  videoHeight: number | null;
  videoBitrateKbps: number | null;
  videoPreset: VideoPresetId;
  videoQuality: VideoQuality;
  audioBitrateKbps: number | null;
  presetLabel: string;
}

export class ConversionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionValidationError";
  }
}

export function allowedFormatsFor(media: MediaCapabilities): OutputFormat[] {
  if (media.hasVideo) return [...OUTPUT_FORMAT_VALUES];
  return ["MP3", "WAV", "AAC", "FLAC"];
}

export function isLosslessAudio(format: OutputFormat) {
  return format === "FLAC" || format === "WAV";
}

export function evenDown(value: number) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

export function videoBitrateFor(preset: VideoPresetId, quality: VideoQuality, sourceHeight?: number | null) {
  const definition = VIDEO_PRESETS.find((item) => item.id === preset) || VIDEO_PRESETS[0];
  const qualityDefinition = VIDEO_QUALITIES.find((item) => item.id === quality) || VIDEO_QUALITIES[1];
  const sourceBitrate = sourceHeight
    ? Math.max(450, Math.round((sourceHeight * sourceHeight * 30 * 0.09) / 1000))
    : 4500;
  const base = definition.baseBitrateKbps ?? sourceBitrate;
  return Math.max(350, Math.round((base * qualityDefinition.multiplier) / 50) * 50);
}

export function normalizeConversionSettings(
  media: MediaCapabilities,
  input: {
    targetFormat: OutputFormat;
    videoPreset?: VideoPresetId | null;
    videoQuality?: VideoQuality | null;
    audioBitrateKbps?: number | null;
  },
): NormalizedConversionSettings {
  const { targetFormat } = input;
  if (!allowedFormatsFor(media).includes(targetFormat)) {
    throw new ConversionValidationError(`${OUTPUT_FORMAT_META[targetFormat].label} is not available for this source.`);
  }

  const meta = OUTPUT_FORMAT_META[targetFormat];
  const videoPreset = input.videoPreset || "source";
  const videoQuality = input.videoQuality || "balanced";
  const audioBitrateKbps = isLosslessAudio(targetFormat)
    ? null
    : (input.audioBitrateKbps && AUDIO_BITRATE_VALUES.includes(input.audioBitrateKbps as AudioBitrate)
        ? input.audioBitrateKbps
        : 192);

  if (meta.family === "audio") {
    if (!media.hasAudio) {
      throw new ConversionValidationError("This source does not contain an audio stream.");
    }
    const label = isLosslessAudio(targetFormat)
      ? "Lossless"
      : `${audioBitrateKbps} kbps`;
    return {
      targetFormat,
      videoHeight: null,
      videoBitrateKbps: null,
      videoPreset,
      videoQuality,
      audioBitrateKbps,
      presetLabel: label,
    };
  }

  if (!media.hasVideo) {
    throw new ConversionValidationError("This source does not contain a video stream.");
  }

  const sourceHeight = media.height || 720;
  const requested = VIDEO_PRESETS.find((item) => item.id === videoPreset) || VIDEO_PRESETS[0];
  const targetHeight = requested.height ? Math.min(requested.height, sourceHeight) : sourceHeight;
  const videoHeight = evenDown(targetHeight);
  const videoBitrateKbps = videoBitrateFor(videoPreset, videoQuality, sourceHeight);
  const presetLabel = `${requested.id === "source" ? "Original" : requested.label.split(" · ")[1]} · ${(videoBitrateKbps / 1000).toFixed(1)} Mbps`;

  return {
    targetFormat,
    videoHeight,
    videoBitrateKbps,
    videoPreset,
    videoQuality,
    audioBitrateKbps: media.hasAudio ? audioBitrateKbps : null,
    presetLabel,
  };
}

export function estimateOutputBytes(settings: NormalizedConversionSettings, durationSeconds: number | null) {
  const duration = Math.max(1, durationSeconds || 0);
  if (OUTPUT_FORMAT_META[settings.targetFormat].family === "audio") {
    if (settings.targetFormat === "WAV") return Math.round(duration * 48000 * 2 * 2);
    if (settings.targetFormat === "FLAC") return Math.round(duration * 48000 * 2 * 2 * 0.65);
    return Math.round((((settings.audioBitrateKbps || 192) * 1000) / 8) * duration);
  }
  const video = (settings.videoBitrateKbps || 2500) * 1000;
  const audio = settings.audioBitrateKbps ? settings.audioBitrateKbps * 1000 : 0;
  return Math.round(((video + audio) / 8) * duration * 1.04);
}
