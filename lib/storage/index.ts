import { env } from "@/lib/env";
import { LocalStorageAdapter } from "@/lib/storage/local";
import { S3StorageAdapter } from "@/lib/storage/s3";
import type { StorageAdapter } from "@/lib/storage/types";

const globalForStorage = globalThis as unknown as {
  clearframeStorage?: StorageAdapter;
};

export function getStorage(): StorageAdapter {
  if (!globalForStorage.clearframeStorage) {
    globalForStorage.clearframeStorage = env.storageDriver === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter();
  }
  return globalForStorage.clearframeStorage;
}

export function storageDriver() {
  return env.storageDriver;
}
