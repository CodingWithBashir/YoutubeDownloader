import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { getGuestStats } from "@/lib/job-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const guest = await ensureGuest(request);
    const stats = await getGuestStats(guest.id);
    const response = jsonResponse(stats);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
