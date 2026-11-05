import type { Readable } from "node:stream";
import type { SignedObjectOptions, SignedObjectUrl } from "@/lib/signed-url";

export interface ObjectRange {
  start: number;
  end: number;
}

export interface ObjectStream {
  stream: Readable;
  size: number;
  range?: ObjectRange;
}

export interface StorageAdapter {
  readonly driver: "s3" | "filesystem";
  putObject(key: string, filePath: string, contentType: string): Promise<void>;
  getObjectToFile(key: string, filePath: string): Promise<void>;
  getObjectStream(key: string, range?: ObjectRange): Promise<ObjectStream>;
  deleteObject(key: string): Promise<void>;
  createSignedUrl(key: string, options: SignedObjectOptions): Promise<SignedObjectUrl>;
  ping(): Promise<void>;
}
