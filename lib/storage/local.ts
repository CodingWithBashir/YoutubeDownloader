import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { env } from "@/lib/env";
import { localObjectUrl } from "@/lib/signed-url";
import { safeStorageKey } from "@/lib/security";
import type { ObjectRange, ObjectStream, StorageAdapter } from "@/lib/storage/types";
import type { SignedObjectOptions, SignedObjectUrl } from "@/lib/signed-url";

export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "filesystem" as const;
  private readonly root = path.resolve(process.cwd(), env.localStorageRoot);

  private absolutePath(key: string) {
    const safeKey = safeStorageKey(key);
    const resolved = path.resolve(this.root, ...safeKey.split("/"));
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new Error("Resolved storage path escaped its root.");
    }
    return resolved;
  }

  async putObject(key: string, filePath: string) {
    const destination = this.absolutePath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await pipeline(createReadStream(filePath), createWriteStream(destination, { flags: "w" }));
  }

  async getObjectToFile(key: string, filePath: string) {
    const source = this.absolutePath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(createReadStream(source), createWriteStream(filePath, { flags: "w" }));
  }

  async getObjectStream(key: string, range?: ObjectRange): Promise<ObjectStream> {
    const source = this.absolutePath(key);
    const info = await stat(source);
    const size = info.size;
    let normalizedRange: ObjectRange | undefined;

    if (range) {
      const start = Math.max(0, Math.min(range.start, size - 1));
      const end = Math.max(start, Math.min(range.end, size - 1));
      normalizedRange = { start, end };
    }

    return {
      stream: createReadStream(source, normalizedRange ? normalizedRange : undefined),
      size,
      range: normalizedRange,
    };
  }

  async deleteObject(key: string) {
    await unlink(this.absolutePath(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async createSignedUrl(key: string, options: SignedObjectOptions): Promise<SignedObjectUrl> {
    return localObjectUrl(key, options.expiresInSeconds, options.disposition || "attachment");
  }

  async ping() {
    await mkdir(this.root, { recursive: true });
  }
}
