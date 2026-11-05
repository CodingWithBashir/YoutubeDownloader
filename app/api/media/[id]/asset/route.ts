import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, notFound } from "@/lib/errors";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { trustedRequestOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kindSchema = z.enum(["thumbnail", "preview"]);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const kind = kindSchema.parse(request.nextUrl.searchParams.get("kind") || "thumbnail");
    const guest = await ensureGuest(request);
    await rateLimit(request, "downloads", guest.guestId);
    const media = await prisma.mediaFile.findFirst({
      where: { id, userId: guest.id, status: "READY", expiresAt: { gt: new Date() } },
      select: {
        displayName: true,
        thumbnailKey: true,
        thumbnailMime: true,
        previewKey: true,
        previewMime: true,
      },
    });
    if (!media) throw notFound("This media asset was not found.");
    const key = kind === "thumbnail" ? media.thumbnailKey : media.previewKey;
    const mimeType = kind === "thumbnail" ? media.thumbnailMime || "image/jpeg" : media.previewMime || "application/octet-stream";
    if (!key) throw notFound(`No ${kind} is available for this file.`);

    const signed = await getStorage().createSignedUrl(key, {
      expiresInSeconds: Math.min(env.downloadTtlSeconds, 900),
      filename: `${kind}-${media.displayName}`,
      mimeType,
      disposition: "inline",
    });
    const destination = new URL(signed.url, trustedRequestOrigin(request));
    const response = NextResponse.redirect(destination, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
