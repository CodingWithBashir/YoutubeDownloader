import { hmac, safeEqual } from "@/lib/crypto";
import { safeStorageKey } from "@/lib/security";

export interface SignedObjectOptions {
  expiresInSeconds: number;
  filename?: string;
  mimeType?: string;
  disposition?: "attachment" | "inline";
}

export interface SignedObjectUrl {
  url: string;
  expiresAt: string;
}

export function signObjectRequest(key: string, expires: number) {
  return hmac(`${key}:${expires}`, "object-download");
}

export function verifyObjectRequest(key: string, expires: string, signature: string) {
  const numericExpiry = Number(expires);
  if (!Number.isFinite(numericExpiry) || numericExpiry <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signObjectRequest(key, numericExpiry), signature);
}

export function localObjectUrl(
  key: string,
  expiresInSeconds: number,
  disposition: "attachment" | "inline" = "attachment",
): SignedObjectUrl {
  const safeKey = safeStorageKey(key);
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const signature = signObjectRequest(safeKey, expires);
  const encodedKey = safeKey.split("/").map(encodeURIComponent).join("/");
  return {
    url: `/api/storage/${encodedKey}?exp=${expires}&sig=${encodeURIComponent(signature)}&disp=${disposition}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}
