import { open, rm, stat } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { convertMediaFile } from "@/lib/media/ffmpeg";
import { probeMedia } from "@/lib/media/ffprobe";
import { normalizeConversionSettings } from "@/lib/presets";
import { validateOutputSignature } from "@/lib/signatures";
import { makeTestWav } from "../helpers/make-wav";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("real FFmpeg worker conversion", () => {
  it("converts a generated WAV to a valid MP3 with measured progress", async () => {
    const created = await makeTestWav(1.5);
    directories.push(created.directory);
    const probe = await probeMedia(created.filePath);
    expect(probe.kind).toBe("AUDIO");
    expect(probe.durationSeconds).toBeGreaterThan(1);

    const progress: number[] = [];
    const outputPath = path.join(created.directory, "output.mp3");
    const settings = normalizeConversionSettings(
      { kind: probe.kind, width: probe.width, height: probe.height, hasVideo: probe.hasVideo, hasAudio: probe.hasAudio, durationSeconds: probe.durationSeconds },
      { targetFormat: "MP3", audioBitrateKbps: 192 },
    );
    const result = await convertMediaFile({
      inputPath: created.filePath,
      outputPath,
      media: { kind: probe.kind, width: probe.width, height: probe.height, hasVideo: probe.hasVideo, hasAudio: probe.hasAudio, durationSeconds: probe.durationSeconds },
      settings,
      onProgress: (value) => progress.push(value),
    });

    expect(result.sizeBytes).toBeGreaterThan(1000);
    expect((await stat(outputPath)).size).toBe(result.sizeBytes);
    expect(progress.every((value) => value >= 0 && value <= 95)).toBe(true);
    const handle = await open(outputPath, "r");
    const head = Buffer.alloc(64);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    await handle.close();
    expect(() => validateOutputSignature("MP3", head.subarray(0, bytesRead))).not.toThrow();
    expect((await probeMedia(outputPath)).durationSeconds).toBeGreaterThan(0.8);
  }, 60_000);

  it("produces a genuine FLAC signature for lossless output", async () => {
    const created = await makeTestWav(0.8);
    directories.push(created.directory);
    const probe = await probeMedia(created.filePath);
    const outputPath = path.join(created.directory, "output.flac");
    const capabilities = { kind: probe.kind, width: probe.width, height: probe.height, hasVideo: probe.hasVideo, hasAudio: probe.hasAudio, durationSeconds: probe.durationSeconds };
    const settings = normalizeConversionSettings(capabilities, { targetFormat: "FLAC" });
    await convertMediaFile({ inputPath: created.filePath, outputPath, media: capabilities, settings });
    const handle = await open(outputPath, "r");
    const head = Buffer.alloc(8);
    await handle.read(head, 0, head.length, 0);
    await handle.close();
    expect(head.toString("ascii", 0, 4)).toBe("fLaC");
    expect(() => validateOutputSignature("FLAC", head)).not.toThrow();
  }, 60_000);
});
