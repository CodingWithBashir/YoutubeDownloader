import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { env } from "@/lib/env";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "INVALID_ORIGIN", "The request origin is invalid.");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const configuredHost = env.appOrigin ? new URL(env.appOrigin).host : "";
  const allowedHosts = new Set([requestHost, configuredHost].filter(Boolean));

  if (!allowedHosts.has(originHost)) {
    throw new ApiError(403, "INVALID_ORIGIN", "Cross-origin state changes are not allowed.");
  }
}

export function trustedRequestOrigin(request: NextRequest) {
  const configured = env.appOrigin.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      throw new ApiError(500, "INVALID_APP_ORIGIN", "APP_ORIGIN must be a valid absolute URL.");
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const hostPattern = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;
  if (!host || host.length > 255 || !hostPattern.test(host)) {
    throw new ApiError(400, "INVALID_HOST", "The request host is invalid.");
  }
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : request.nextUrl.protocol.replace(/:$/, "") || "http";
  return `${protocol}://${host}`;
}

export function sanitizeFilename(input: string) {
  const normalized = input.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "");
  const basename = normalized.split(/[\\/]/).pop() || "media";
  const cleaned = basename
    .replace(/^\.+/, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return cleaned || "media";
}

export function safeExtension(filename: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(filename);
  return match ? match[1].toLowerCase() : "";
}

export function safeStorageKey(key: string) {
  if (!key || key.length > 512 || !/^[A-Za-z0-9._\-/]+$/.test(key)) {
    throw new ApiError(400, "INVALID_STORAGE_KEY", "The object key contains unsafe characters.");
  }
  if (key.startsWith("/") || key.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new ApiError(400, "INVALID_STORAGE_KEY", "The object key is not a safe relative path.");
  }
  return key;
}

export function safeContentDisposition(filename: string) {
  const cleaned = sanitizeFilename(filename).replace(/["\r\n]/g, "");
  return `attachment; filename="${cleaned}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
