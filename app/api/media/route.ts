import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { attachSessionCookie, ensureGuest } from "@/lib/session";
import { getMediaByIds } from "@/lib/job-service";
import { idsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ids = idsQuerySchema.parse(request.nextUrl.searchParams.get("ids") || "");
    const guest = await ensureGuest(request);
    const media = await getMediaByIds(guest.id, ids);
    const response = jsonResponse({ media, missingIds: ids.filter((id) => !media.some((item) => item.id === id)) });
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}
