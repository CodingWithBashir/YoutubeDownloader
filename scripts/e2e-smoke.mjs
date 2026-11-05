import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

const baseUrl = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
let cookie = "";

async function api(pathname, init = {}) {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers, redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return response;
}

function makeWav(durationSeconds = 2) {
  const sampleRate = 22050;
  const count = Math.floor(sampleRate * durationSeconds);
  const dataBytes = count * 2;
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
  for (let index = 0; index < count; index += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.28;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

async function main() {
  const health = await api("/api/health");
  assert.equal(health.status, 200, "health endpoint must be available");
  const healthBody = await health.json();
  assert.equal(healthBody.checks.database, "ok", "database must be reachable");
  console.log("[e2e] health", healthBody);

  const form = new FormData();
  form.append("files", new Blob([makeWav()], { type: "audio/wav" }), "clearframe-smoke.wav");
  const upload = await api("/api/uploads", { method: "POST", body: form });
  const uploadBody = await upload.json();
  assert.equal(upload.status, 201, JSON.stringify(uploadBody));
  assert.equal(uploadBody.media.length, 1);
  const media = uploadBody.media[0];
  assert.equal(media.kind, "AUDIO");
  assert.equal(media.container, "wav");
  console.log("[e2e] uploaded", { id: media.id, durationSeconds: media.durationSeconds, hasPreview: media.hasPreview });

  const create = await api("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      authorized: true,
      items: [{ mediaId: media.id, targetFormat: "MP3", audioBitrateKbps: 192, videoPreset: "source", videoQuality: "balanced" }],
    }),
  });
  const createBody = await create.json();
  assert.equal(create.status, 201, JSON.stringify(createBody));
  assert.equal(createBody.jobs[0].status, "QUEUED");
  const batchId = createBody.batchId;
  console.log("[e2e] queued", { batchId, jobId: createBody.jobs[0].id });

  let batch;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const response = await api(`/api/batches/${batchId}`);
    assert.equal(response.status, 200, "batch endpoint must be available");
    batch = (await response.json()).batch;
    console.log(`[e2e] poll ${attempt}: ${batch.status} ${batch.aggregateProgress}%`);
    if (["COMPLETED", "FAILED", "CANCELED"].includes(batch.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(batch?.status, "COMPLETED", "worker must complete a real conversion");
  assert.equal(batch.aggregateProgress, 100);
  assert.ok(batch.jobs[0].outputs.length, "a persisted ConversionOutput must exist");
  const output = batch.jobs[0].outputs[0];
  assert.equal(output.mimeType, "audio/mpeg");
  console.log("[e2e] completed", { outputId: output.id, sizeBytes: output.sizeBytes, workerId: batch.jobs[0].workerId });

  const redirect = await api(`/api/outputs/${output.id}/download`);
  assert.equal(redirect.status, 307, "download endpoint must issue a signed redirect");
  const location = redirect.headers.get("location");
  assert.ok(location, "signed redirect location is required");
  const signed = await fetch(location, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  assert.equal(signed.status, 200, "signed object URL must be authorized");
  assert.match(signed.headers.get("content-type") || "", /audio\/mpeg/);
  const bytes = Buffer.from(await signed.arrayBuffer());
  assert.equal(bytes.length, output.sizeBytes);
  assert.ok(bytes.length > 1000, "downloaded MP3 must contain real encoded data");

  const directory = await mkdtemp(path.join(os.tmpdir(), "clearframe-e2e-"));
  const outputPath = path.join(directory, "result.mp3");
  await writeFile(outputPath, bytes);
  const probe = spawnSync(process.env.FFPROBE_PATH || ffprobeInstaller.path, [
    "-v", "error", "-print_format", "json", "-show_entries", "format=format_name,duration,size", outputPath,
  ], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr);
  const probeBody = JSON.parse(probe.stdout);
  assert.match(probeBody.format.format_name, /mp3/);
  assert.ok(Number(probeBody.format.duration) > 1);
  await rm(directory, { recursive: true, force: true });
  console.log("[e2e] downloaded and probed", probeBody.format);
  console.log("[e2e] PASS: upload → persistent job → FFmpeg worker → signed download");
}

main().catch((error) => {
  console.error("[e2e] FAIL", error);
  process.exit(1);
});
