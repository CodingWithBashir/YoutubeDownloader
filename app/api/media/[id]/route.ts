import type { NextRequest } from "next/server";
import { handleApiError, notFound } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { assertSameOrigin } from "@/lib/security";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { deleteMedia, getMediaByIds } from "@/lib/job-service";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guest = await ensureGuest(request);
    const [media] = await getMediaByIds(guest.id, [id]);
    if (!media) throw notFound("This media file was not found.");
    const response = jsonResponse({ media });
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const guest = await ensureGuest(request);
    await rateLimit(request, "jobs", guest.guestId);
    const result = await deleteMedia(guest.id, id);
    const response = jsonResponse(result);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
