import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function secretFor(name: "SESSION_SECRET" | "DOWNLOAD_SECRET") {
  const value = process.env[name] || (name === "DOWNLOAD_SECRET" ? process.env.SESSION_SECRET : "");
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to at least 32 random characters.`);
  }
  return value;
}

export function hmac(value: string, purpose: string) {
  return createHmac("sha256", secretFor("SESSION_SECRET"))
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomId() {
  return randomUUID();
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
