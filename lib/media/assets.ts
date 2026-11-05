import path from "node:path";
import { stat } from "node:fs/promises";
import { runFfmpeg } from "@/lib/media/process";
import type { MediaProbe } from "@/lib/media/ffprobe";

export interface GeneratedAsset {
  kind: "thumbnail" | "preview";
  filePath: string;
  extension: string;
  mimeType: string;
}

const ASSET_TIMEOUT_MS = 60_000;

async function generate(asset: GeneratedAsset, args: string[]) {
  await runFfmpeg(args, { timeoutMs: ASSET_TIMEOUT_MS });
  const info = await stat(asset.filePath);
  if (info.size <= 0) throw new Error("Asset was empty.");
  return asset;
}

export async function generatePreviewAssets(inputPath: string, media: MediaProbe, directory: string) {
  const assets: GeneratedAsset[] = [];
  const duration = Math.max(0.1, media.durationSeconds || 1);
  const start = Math.min(1, duration / 10).toFixed(2);
  const common = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"];

  if (media.hasVideo) {
    const thumbnail: GeneratedAsset = {
      kind: "thumbnail",
      filePath: path.join(directory, "thumbnail.jpg"),
      extension: "jpg",
      mimeType: "image/jpeg",
    };
    await generate(thumbnail, [
      ...common,
      "-ss",
      start,
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-2",
      "-q:v",
      "4",
      thumbnail.filePath,
    ]).then((value) => assets.push(value)).catch((error) => console.warn("[clearframe] thumbnail skipped", error));

    const preview: GeneratedAsset = {
      kind: "preview",
      filePath: path.join(directory, "preview.mp4"),
      extension: "mp4",
      mimeType: "video/mp4",
    };
    await generate(preview, [
      ...common,
      "-ss",
      start,
      "-i",
      inputPath,
      "-t",
      Math.min(5, duration).toFixed(2),
      "-map",
      "0:v:0",
      "-vf",
      "scale=480:-2",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "32",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      preview.filePath,
    ]).then((value) => assets.push(value)).catch((error) => console.warn("[clearframe] preview skipped", error));
  } else if (media.hasAudio) {
    const thumbnail: GeneratedAsset = {
      kind: "thumbnail",
      filePath: path.join(directory, "waveform.png"),
      extension: "png",
      mimeType: "image/png",
    };
    await generate(thumbnail, [
      ...common,
      "-i",
      inputPath,
      "-filter_complex",
      "showwavespic=s=960x240:colors=0x38BDF8",
      "-frames:v",
      "1",
      thumbnail.filePath,
    ]).then((value) => assets.push(value)).catch((error) => console.warn("[clearframe] waveform skipped", error));

    const preview: GeneratedAsset = {
      kind: "preview",
      filePath: path.join(directory, "audio-preview.mp3"),
      extension: "mp3",
      mimeType: "audio/mpeg",
    };
    await generate(preview, [
      ...common,
      "-i",
      inputPath,
      "-t",
      Math.min(10, duration).toFixed(2),
      "-map",
      "0:a:0",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      preview.filePath,
    ]).then((value) => assets.push(value)).catch((error) => console.warn("[clearframe] audio preview skipped", error));
  }

  return assets;
}
