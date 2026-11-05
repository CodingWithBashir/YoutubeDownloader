import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function makeTestWav(durationSeconds = 1) {
  const sampleRate = 22050;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataBytes = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.28;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), "clearframe-test-wav-"));
  const filePath = path.join(directory, "tone.wav");
  await writeFile(filePath, buffer);
  return { directory, filePath, buffer };
}
