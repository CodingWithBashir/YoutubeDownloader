import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleApiError, notFound } from "@/lib/errors";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { safeContentDisposition, safeStorageKey } from "@/lib/security";
import { verifyObjectRequest } from "@/lib/signed-url";
import type { ObjectRange } from "@/lib/storage/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRange(header: string | null, size: number): ObjectRange | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";
  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return "invalid";
  let start: number;
  let end: number;
  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) return "invalid";
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  try {
    const { key: segments } = await context.params;
    const key = safeStorageKey(segments.map(decodeURIComponent).join("/"));
    const expires = request.nextUrl.searchParams.get("exp") || "";
    const signature = request.nextUrl.searchParams.get("sig") || "";
    if (!verifyObjectRequest(key, expires, signature)) {
      throw notFound("This signed link is invalid or has expired.");
    }

    const guest = await ensureGuest(request);
    const now = new Date();
    const output = await prisma.conversionOutput.findFirst({
      where: {
        objectKey: key,
        expiresAt: { gt: now },
        job: { userId: guest.id, status: "COMPLETED" },
      },
      select: { fileName: true, mimeType: true },
    });
    const media = output
      ? null
      : await prisma.mediaFile.findFirst({
          where: {
            userId: guest.id,
            status: "READY",
            expiresAt: { gt: now },
            OR: [{ sourceKey: key }, { thumbnailKey: key }, { previewKey: key }],
          },
          select: {
            displayName: true,
            mimeType: true,
            sourceKey: true,
            thumbnailKey: true,
            thumbnailMime: true,
            previewKey: true,
            previewMime: true,
          },
        });
    if (!output && !media) throw notFound("The requested object is not available to this session.");

    let contentType = output?.mimeType || "application/octet-stream";
    let filename = output?.fileName || "media";
    if (media) {
      filename = media.displayName;
      if (key === media.thumbnailKey) contentType = media.thumbnailMime || "image/jpeg";
      else if (key === media.previewKey) contentType = media.previewMime || "application/octet-stream";
      else contentType = media.mimeType;
    }

    const provisional = await getStorage().getObjectStream(key);
    const range = parseRange(request.headers.get("range"), provisional.size);
    if (range === "invalid") {
      provisional.stream.destroy();
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${provisional.size}`, "Cache-Control": "private, no-store" },
      });
    }
    const object = range ? await getStorage().getObjectStream(key, range) : provisional;
    if (range) provisional.stream.destroy();
    const disposition = request.nextUrl.searchParams.get("disp") === "inline" && !output ? "inline" : safeContentDisposition(filename);
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Length": String(object.range ? object.range.end - object.range.start + 1 : object.size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.range) {
      headers.set("Content-Range", `bytes ${object.range.start}-${object.range.end}/${object.size}`);
    }
    const response = new NextResponse(Readable.toWeb(object.stream) as unknown as ReadableStream, {
      status: object.range ? 206 : 200,
      headers,
    });
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
