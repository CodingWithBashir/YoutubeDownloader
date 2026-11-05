import type { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/security";
import { attachSessionCookie, ensureGuest, getSessionFromRequest } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { parseMultipartUpload } from "@/lib/multipart";
import { ingestMediaFile } from "@/lib/media/ingest";
import { prisma } from "@/lib/prisma";
import { cleanupExpired } from "@/lib/cleanup";
import { ApiError, handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import type { MediaDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | undefined;
  try {
    assertSameOrigin(request);
    const session = getSessionFromRequest(request);
    await rateLimit(request, "uploads", session.guestId);
    const guest = await ensureGuest(request);
    const upload = await parseMultipartUpload(request);
    cleanup = upload.cleanup;

    const media: MediaDTO[] = [];
    try {
      for (const file of upload.files) {
        media.push(
          await ingestMediaFile({
            userId: guest.id,
            filePath: file.filePath,
            filename: file.filename,
            declaredMime: file.declaredMime,
          }),
        );
      }
    } catch (error) {
      if (media.length) {
        await prisma.mediaFile.updateMany({
          where: { id: { in: media.map((item) => item.id) }, userId: guest.id },
          data: { status: "EXPIRED", expiresAt: new Date() },
        });
        await cleanupExpired().catch(() => undefined);
      }
      throw error;
    }

    const response = jsonResponse({ media }, 201);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    await cleanup?.();
    if (error instanceof ApiError || (error instanceof Error && ["MediaValidationError", "UrlImportError"].includes(error.name))) {
      return handleApiError(error);
    }
    return handleApiError(error);
  } finally {
    await cleanup?.();
  }
}
