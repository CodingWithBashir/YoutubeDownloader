import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import ipaddr from "ipaddr.js";
import { env } from "@/lib/env";
import { sanitizeFilename } from "@/lib/security";

export class UrlImportError extends Error {
  constructor(
    message: string,
    public code = "UNSAFE_URL",
  ) {
    super(message);
    this.name = "UrlImportError";
  }
}

const BLOCKED_HOST_SUFFIXES = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "googlevideo.com",
  "facebook.com",
  "fb.watch",
  "instagram.com",
  "tiktok.com",
  "vimeo.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "dailymotion.com",
  "twitch.tv",
  "bilibili.com",
  "soundcloud.com",
];

const BLOCKED_EXTENSIONS = ["m3u8", "mpd", "ism", "ismc", "html", "htm", "php", "asp", "aspx", "jsp", "json", "xml"];

export function isPublicIpAddress(value: string) {
  try {
    let address = ipaddr.parse(value);
    if (address.kind() === "ipv6" && (address as ipaddr.IPv6).isIPv4MappedAddress()) {
      address = (address as ipaddr.IPv6).toIPv4Address();
    }
    return address.range() === "unicast";
  } catch {
    return false;
  }
}

function normalizedHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
}

function rejectPrivateHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".localdomain") ||
    lower.endsWith(".home.arpa")
  ) {
    throw new UrlImportError("Private or local network hosts are not allowed.", "PRIVATE_HOST");
  }
  if (net.isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new UrlImportError("Private, loopback and reserved IP addresses are not allowed.", "PRIVATE_IP");
  }
  if (BLOCKED_HOST_SUFFIXES.some((domain) => lower === domain || lower.endsWith(`.${domain}`))) {
    throw new UrlImportError(
      "Streaming and social-media pages are not supported. Use a direct media-file URL you are authorized to process.",
      "STREAMING_PAGE",
    );
  }
}

export function assertDirectMediaUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlImportError("Enter a valid absolute http or https URL.", "INVALID_URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UrlImportError("Only http and https direct media-file URLs are allowed.", "INVALID_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new UrlImportError("URLs containing embedded credentials are not allowed.", "URL_CREDENTIALS");
  }
  if (input.length > 2048 || /[\u0000-\u001f\u007f]/.test(input)) {
    throw new UrlImportError("The URL contains invalid characters or is too long.", "INVALID_URL");
  }
  const hostname = normalizedHostname(url);
  if (!hostname) throw new UrlImportError("The URL has no hostname.", "INVALID_URL");
  rejectPrivateHostname(hostname);

  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) {
    throw new UrlImportError("Only standard ports 80 and 443 are allowed.", "UNSAFE_PORT");
  }
  const pathname = url.pathname.toLowerCase();
  const extension = pathname.includes(".") ? pathname.split(".").pop()!.split("/")[0] : "";
  if (extension && BLOCKED_EXTENSIONS.includes(extension)) {
    throw new UrlImportError("Streaming playlists, web pages and manifests are not direct media files.", "NOT_DIRECT_FILE");
  }
  return { url, hostname };
}

function allowedContentType(value: string | undefined) {
  const contentType = (value || "").split(";")[0].trim().toLowerCase();
  if (!contentType) return false;
  if (contentType.startsWith("video/") || contentType.startsWith("audio/")) return true;
  return ["application/octet-stream", "binary/octet-stream", "application/ogg"].includes(contentType);
}

function filenameFromDisposition(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utfMatch) {
    try {
      return sanitizeFilename(decodeURIComponent(utfMatch[1].replace(/^"|"$/g, "")));
    } catch {
      // fall through
    }
  }
  const match = /filename="?([^";]+)"?/i.exec(value);
  return match ? sanitizeFilename(match[1]) : fallback;
}

type LookupCallback = (
  error: Error | null,
  address: string | dns.LookupAddress[] | "",
  family?: number,
) => void;

interface SafeLookupOptions {
  all?: boolean;
  family?: number | "IPv4" | "IPv6";
  hints?: number;
  verbatim?: boolean;
}

type ValidatedLookup = (hostname: string, options: SafeLookupOptions, callback: LookupCallback) => void;

function validatedLookup(): ValidatedLookup {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (error, records) => {
      if (error) {
        callback(error, "", 0);
        return;
      }
      const unsafe = records.find((record) => !isPublicIpAddress(record.address));
      if (unsafe) {
        callback(new UrlImportError("The destination resolved to a private or reserved address.", "DNS_REBINDING"), "", 0);
        return;
      }
      const first = records[0];
      if (!first) {
        callback(new UrlImportError("The destination did not resolve to a public address.", "DNS_FAILED"), "", 0);
        return;
      }
      if (options?.all) {
        callback(null, records);
      } else {
        callback(null, first.address, first.family);
      }
    });
  };
}

interface FetchResult {
  bytes: number;
  contentType: string;
  filename: string;
  hostname: string;
}

async function requestOnce(
  input: URL,
  destination: string,
  redirectsLeft: number,
): Promise<FetchResult> {
  const { hostname } = assertDirectMediaUrl(input.toString());
  const transport = input.protocol === "https:" ? https : http;
  return new Promise<FetchResult>((resolve, reject) => {
    const request = transport.request(
      input,
      {
        method: "GET",
        agent: false,
        lookup: validatedLookup(),
        timeout: 15_000,
        headers: {
          Accept: "video/*,audio/*,application/octet-stream;q=0.9,*/*;q=0.1",
          "User-Agent": "Clearframe/1.0 (+authorized-direct-media-import)",
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          if (redirectsLeft <= 0) {
            reject(new UrlImportError("Too many redirects.", "UNSAFE_REDIRECT"));
            return;
          }
          let next: URL;
          try {
            next = new URL(location, input);
          } catch {
            reject(new UrlImportError("The redirect destination is invalid.", "UNSAFE_REDIRECT"));
            return;
          }
          if (input.protocol === "https:" && next.protocol !== "https:") {
            reject(new UrlImportError("Redirects from HTTPS to HTTP are not allowed.", "UNSAFE_REDIRECT"));
            return;
          }
          request.destroy();
          resolve(requestOnce(next, destination, redirectsLeft - 1));
          return;
        }

        if (status !== 200) {
          response.resume();
          reject(new UrlImportError(`The direct media URL returned HTTP ${status}.`, "HTTP_ERROR"));
          return;
        }

        const contentType = Array.isArray(response.headers["content-type"])
          ? response.headers["content-type"][0]
          : response.headers["content-type"];
        if (!allowedContentType(contentType)) {
          response.resume();
          reject(
            new UrlImportError(
              "The URL did not return a video or audio media type. Streaming pages and documents are rejected.",
              "UNSUPPORTED_CONTENT_TYPE",
            ),
          );
          return;
        }

        const contentLength = Number(response.headers["content-length"] || 0);
        if (contentLength > env.maxImportBytes) {
          response.resume();
          reject(new UrlImportError("The remote file exceeds the configured size limit.", "FILE_TOO_LARGE"));
          return;
        }

        let bytes = 0;
        let failed = false;
        const counter = new Transform({
          transform(chunk, _encoding, callback) {
            bytes += chunk.length;
            if (bytes > env.maxImportBytes) {
              failed = true;
              callback(new UrlImportError("The streamed file exceeded the configured size limit.", "FILE_TOO_LARGE"));
              return;
            }
            callback(null, chunk);
          },
        });

        const fallbackName = sanitizeFilename(decodeURIComponent(input.pathname.split("/").pop() || "imported-media"));
        const filename = filenameFromDisposition(
          Array.isArray(response.headers["content-disposition"])
            ? response.headers["content-disposition"][0]
            : response.headers["content-disposition"],
          fallbackName,
        );

        pipeline(response, counter, createWriteStream(destination, { flags: "w" }))
          .then(() => {
            if (failed) return;
            if (bytes === 0) throw new UrlImportError("The remote file was empty.", "EMPTY_FILE");
            resolve({
              bytes,
              contentType: contentType!.split(";")[0].trim().toLowerCase(),
              filename,
              hostname,
            });
          })
          .catch((error) => {
            request.destroy();
            reject(error instanceof UrlImportError ? error : new UrlImportError(`Import failed: ${String(error)}`));
          });
      },
    );

    request.on("timeout", () => request.destroy(new UrlImportError("The remote host timed out.", "IMPORT_TIMEOUT")));
    request.on("error", (error) => reject(error instanceof UrlImportError ? error : new UrlImportError(`Import failed: ${error.message}`)));
    request.end();
  });
}

export async function fetchAuthorizedDirectMedia(input: string, destination: string) {
  const { url } = assertDirectMediaUrl(input);
  try {
    return await requestOnce(url, destination, 2);
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
}
