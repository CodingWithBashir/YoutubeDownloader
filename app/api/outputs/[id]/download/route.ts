import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleApiError, notFound } from "@/lib/errors";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { trustedRequestOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guest = await ensureGuest(request);
    await rateLimit(request, "downloads", guest.guestId);
    const output = await prisma.conversionOutput.findFirst({
      where: {
        id,
        expiresAt: { gt: new Date() },
        job: { userId: guest.id, status: "COMPLETED" },
      },
      select: { id: true, objectKey: true, fileName: true, mimeType: true },
    });
    if (!output) throw notFound("This download is no longer available.");
    await prisma.conversionOutput.update({ where: { id: output.id }, data: { downloadCount: { increment: 1 } } });
    const signed = await getStorage().createSignedUrl(output.objectKey, {
      expiresInSeconds: env.downloadTtlSeconds,
      filename: output.fileName,
      mimeType: output.mimeType,
      disposition: "attachment",
    });
    const destination = new URL(signed.url, trustedRequestOrigin(request));
    const response = NextResponse.redirect(destination, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
