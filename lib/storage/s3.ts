import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { safeContentDisposition, safeStorageKey } from "@/lib/security";
import type { ObjectRange, ObjectStream, StorageAdapter } from "@/lib/storage/types";
import type { SignedObjectOptions, SignedObjectUrl } from "@/lib/signed-url";

export class S3StorageAdapter implements StorageAdapter {
  readonly driver = "s3" as const;
  private readonly client: S3Client;
  private readonly config = env.s3;

  constructor() {
    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async putObject(key: string, filePath: string, contentType: string) {
    const info = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: safeStorageKey(key),
        Body: createReadStream(filePath),
        ContentLength: info.size,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }),
    );
  }

  async getObjectToFile(key: string, filePath: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: safeStorageKey(key) }),
    );
    if (!response.Body) throw new Error("The stored object was empty.");
    await mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(response.Body as Readable, createWriteStream(filePath, { flags: "w" }));
  }

  async getObjectStream(key: string, range?: ObjectRange): Promise<ObjectStream> {
    const safeKey = safeStorageKey(key);
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: safeKey }));
    const size = Number(head.ContentLength || 0);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: safeKey,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    if (!response.Body) throw new Error("The stored object was empty.");
    return { stream: response.Body as Readable, size, range };
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: safeStorageKey(key) }));
  }

  async createSignedUrl(key: string, options: SignedObjectOptions): Promise<SignedObjectUrl> {
    const expiresIn = Math.max(30, Math.min(options.expiresInSeconds, 3600));
    const disposition =
      options.disposition === "inline"
        ? "inline"
        : safeContentDisposition(options.filename || "download");
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: safeStorageKey(key),
      ResponseContentDisposition: disposition,
      ResponseContentType: options.mimeType,
      ResponseCacheControl: "private, no-store",
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
  }

  async ping() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }
}
