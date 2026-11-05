import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { listHistory } from "@/lib/job-service";

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
