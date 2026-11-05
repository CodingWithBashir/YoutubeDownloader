import { randomUUID } from "node:crypto";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { sanitizeFilename } from "@/lib/security";
import { containerExtension, validateMediaSignature } from "@/lib/signatures";
import { getStorage } from "@/lib/storage";
import { serializeMedia } from "@/lib/serializers";
import { generatePreviewAssets } from "@/lib/media/assets";
import { probeMedia } from "@/lib/media/ffprobe";
import { hashFile } from "@/lib/hash-file";

async function readHead(filePath: string, bytes = 512) {
  const handle = await open(filePath, "r");
  const buffer = Buffer.alloc(bytes);
  const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
  await handle.close();
  return buffer.subarray(0, bytesRead);
}


export interface IngestMediaOptions {
  userId: string;
  filePath: string;
  filename: string;
  declaredMime?: string | null;
  sourceDomain?: string | null;
}

export async function ingestMediaFile(options: IngestMediaOptions) {
  const displayName = sanitizeFilename(options.filename);
  const head = await readHead(options.filePath);
  const signature = validateMediaSignature({
    head,
    filename: displayName,
    declaredMime: options.declaredMime,
    allowUnknownExtension: Boolean(options.sourceDomain),
  });
  const probe = await probeMedia(options.filePath);
  const info = await stat(options.filePath);
  if (info.size > env.maxUploadBytes) {
    throw new Error("The media file exceeds the configured size limit.");
  }
  const sha256 = await hashFile(options.filePath);
  const base = `${options.userId}/${randomUUID()}`;
  const sourceKey = `${base}/source.${containerExtension(signature.container)}`;
  const storage = getStorage();

  const assetDirectory = await mkdtemp(path.join(os.tmpdir(), "clearframe-assets-"));
  const storedKeys: string[] = [sourceKey];
  try {
    const assets = await generatePreviewAssets(options.filePath, probe, assetDirectory);
    await storage.putObject(sourceKey, options.filePath, signature.mimeType);

    let thumbnailKey: string | null = null;
    let thumbnailMime: string | null = null;
    let previewKey: string | null = null;
    let previewMime: string | null = null;

    for (const asset of assets) {
      const key = `${base}/${asset.kind}.${asset.extension}`;
      await storage.putObject(key, asset.filePath, asset.mimeType);
      storedKeys.push(key);
      if (asset.kind === "thumbnail") {
        thumbnailKey = key;
        thumbnailMime = asset.mimeType;
      } else {
        previewKey = key;
        previewMime = asset.mimeType;
      }
    }

    const record = await prisma.mediaFile.create({
      data: {
        userId: options.userId,
        displayName,
        mimeType: signature.mimeType,
        container: signature.container,
        sizeBytes: BigInt(info.size),
        durationSeconds: probe.durationSeconds,
        width: probe.width,
        height: probe.height,
        frameRate: probe.frameRate,
        videoCodec: probe.videoCodec,
        audioCodec: probe.audioCodec,
        hasVideo: probe.hasVideo,
        hasAudio: probe.hasAudio,
        kind: probe.kind,
        sha256,
        sourceKey,
        thumbnailKey,
        thumbnailMime,
        previewKey,
        previewMime,
        sourceDomain: options.sourceDomain?.slice(0, 255) || null,
        status: "READY",
        expiresAt: new Date(Date.now() + env.retentionHours * 3600_000),
      },
    });
    return serializeMedia(record);
  } catch (error) {
    await Promise.all(storedKeys.map((key) => storage.deleteObject(key).catch(() => undefined)));
    throw error;
  } finally {
    await rm(assetDirectory, { recursive: true, force: true });
  }
}
