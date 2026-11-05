import { rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { detectContainer, validateMediaSignature, validateOutputSignature, MediaValidationError } from "@/lib/signatures";
import { makeTestWav } from "../helpers/make-wav";

describe("media signature validation", () => {
  it("detects common real container headers", () => {
    const wav = Buffer.alloc(16); wav.write("RIFF", 0, "ascii"); wav.write("WAVE", 8, "ascii");
    const mp4 = Buffer.alloc(16); mp4.write("ftypisom", 4, "ascii");
    const flac = Buffer.from("fLaC0000", "ascii");
    const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    expect(detectContainer(wav)).toBe("wav");
    expect(detectContainer(mp4)).toBe("mp4");
    expect(detectContainer(flac)).toBe("flac");
    expect(detectContainer(mp3)).toBe("mp3");
    expect(detectContainer(Buffer.from("<!doctype html>"))).toBeNull();
  });

  it("rejects HTML disguised as an MP4 upload", () => {
    expect(() => validateMediaSignature({
      head: Buffer.from("<!doctype html><html><script>alert(1)</script></html>"),
      filename: "not-a-video.mp4", declaredMime: "video/mp4",
    })).toThrow(MediaValidationError);
  });

  it("rejects MIME and extension mismatches", () => {
    const wav = Buffer.alloc(16); wav.write("RIFF", 0, "ascii"); wav.write("WAVE", 8, "ascii");
    expect(() => validateMediaSignature({ head: wav, filename: "song.wav", declaredMime: "video/mp4" })).toThrow(/MIME/);
    expect(() => validateMediaSignature({ head: wav, filename: "song.mp4", declaredMime: "audio/wav" })).toThrow(/extension/);
  });

  it("validates a generated WAV and its converted-output signature", async () => {
    const { buffer, directory } = await makeTestWav(0.2);
    const validated = validateMediaSignature({ head: buffer.subarray(0, 64), filename: "tone.wav", declaredMime: "audio/wav" });
    expect(validated.container).toBe("wav");
    expect(validated.mimeType).toBe("audio/wav");
    expect(() => validateOutputSignature("WAV", buffer.subarray(0, 64))).not.toThrow();
    expect(() => validateOutputSignature("MP3", buffer.subarray(0, 64))).toThrow(MediaValidationError);
    await rm(directory, { recursive: true, force: true });
  });
});
