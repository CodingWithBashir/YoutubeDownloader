import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse, parseJson } from "@/lib/api-helpers";
import { attachSessionCookie, ensureGuest, getSessionFromRequest } from "@/lib/session";
import { assertSameOrigin } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { createConversionJobs, listHistory } from "@/lib/job-service";
import { createJobsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const guest = await ensureGuest(request);
    const params = request.nextUrl.searchParams;
    const result = await listHistory(guest.id, {
      q: params.get("q"),
      status: params.get("status"),
      page: params.get("page"),
      limit: params.get("limit"),
    });
    const response = jsonResponse(result);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await parseJson(request, createJobsSchema);
    const session = getSessionFromRequest(request);
    await rateLimit(request, "jobs", session.guestId);
    const guest = await ensureGuest(request);
    const result = await createConversionJobs(guest.id, body.items);
    const response = jsonResponse(result, 201);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
