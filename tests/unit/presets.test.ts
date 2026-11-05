import { describe, expect, it } from "vitest";
import { allowedFormatsFor, normalizeConversionSettings, ConversionValidationError, videoBitrateFor } from "@/lib/presets";

const video = { kind: "VIDEO" as const, width: 1920, height: 1080, hasVideo: true, hasAudio: true, durationSeconds: 60 };
const audio = { kind: "AUDIO" as const, width: null, height: null, hasVideo: false, hasAudio: true, durationSeconds: 60 };

describe("conversion presets", () => {
  it("limits audio-only sources to audio outputs", () => {
    expect(allowedFormatsFor(audio)).toEqual(["MP3", "WAV", "AAC", "FLAC"]);
    expect(() => normalizeConversionSettings(audio, { targetFormat: "MP4" })).toThrow(ConversionValidationError);
  });
  it("supports audio extraction from a video source", () => {
    const settings = normalizeConversionSettings(video, { targetFormat: "MP3", audioBitrateKbps: 256 });
    expect(settings.audioBitrateKbps).toBe(256);
    expect(settings.videoHeight).toBeNull();
    expect(settings.presetLabel).toBe("256 kbps");
  });
  it("caps requested resolution and never emits an odd height", () => {
    const settings = normalizeConversionSettings(video, { targetFormat: "MP4", videoPreset: "2160p", videoQuality: "balanced" });
    expect(settings.videoHeight).toBe(1080);
    expect(settings.videoHeight! % 2).toBe(0);
    expect(videoBitrateFor("720p", "high", 1080)).toBeGreaterThan(videoBitrateFor("720p", "efficient", 1080));
  });
  it("treats WAV and FLAC as lossless", () => {
    const settings = normalizeConversionSettings(audio, { targetFormat: "FLAC", audioBitrateKbps: 320 });
    expect(settings.audioBitrateKbps).toBeNull();
    expect(settings.presetLabel).toBe("Lossless");
  });
});
