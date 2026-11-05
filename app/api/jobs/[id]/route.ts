import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { assertSameOrigin } from "@/lib/security";
import { cancelJob, getJob } from "@/lib/job-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guest = await ensureGuest(request);
    const job = await getJob(guest.id, id);
    const response = jsonResponse({ job });
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
    const job = await cancelJob(guest.id, id);
    const response = jsonResponse({ job });
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
