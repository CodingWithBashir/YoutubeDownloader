import { describe, expect, it } from "vitest";
import { buildFfmpegArgs, parseFfmpegProgress } from "@/lib/media/ffmpeg";
import { normalizeConversionSettings } from "@/lib/presets";
import { createJobsSchema } from "@/lib/validation";

describe("FFmpeg argument builder", () => {
  const media = { kind: "VIDEO" as const, width: 1920, height: 1080, hasVideo: true, hasAudio: true, durationSeconds: 30 };

  it("builds a fixed MP4 argument array with validated numeric presets", () => {
    const settings = normalizeConversionSettings(media, { targetFormat: "MP4", videoPreset: "720p", videoQuality: "balanced" });
    const args = buildFfmpegArgs({ inputPath: "/tmp/source.mp4", outputPath: "/tmp/output.mp4", media, settings });
    expect(args).toContain("libx264");
    expect(args).toContain("scale=1280:720:flags=lanczos,setsar=1");
    expect(args.at(-1)).toBe("/tmp/output.mp4");
    expect(args.join(" ")).not.toMatch(/[;&|`$]/);
  });

  it("builds audio extraction without a video stream", () => {
    const settings = normalizeConversionSettings(media, { targetFormat: "MP3", audioBitrateKbps: 192 });
    const args = buildFfmpegArgs({ inputPath: "/tmp/source.mp4", outputPath: "/tmp/output.mp3", media, settings });
    expect(args).toContain("-vn");
    expect(args).toContain("libmp3lame");
    expect(args).not.toContain("libx264");
  });

  it("parses real out_time progress and never exceeds the encoding cap", () => {
    expect(parseFfmpegProgress("out_time_ms=15000000", 30)).toBe(47.5);
    expect(parseFfmpegProgress("out_time_ms=60000000", 30)).toBe(95);
    expect(parseFfmpegProgress("progress=end", 30)).toBeNull();
  });

  it("rejects unsupported output formats before worker dispatch", () => {
    const result = createJobsSchema.safeParse({
      authorized: true,
      items: [{ mediaId: "6f1a13cb-7c0f-43c5-9b28-1ce4c7b1b7ba", targetFormat: "MP4; rm -rf /", videoPreset: "source", videoQuality: "balanced" }],
    });
    expect(result.success).toBe(false);
  });
});
