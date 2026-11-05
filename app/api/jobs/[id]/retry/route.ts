import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { assertSameOrigin } from "@/lib/security";
import { retryJob } from "@/lib/job-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const guest = await ensureGuest(request);
    const result = await retryJob(guest.id, id);
    const response = jsonResponse(result, 201);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
