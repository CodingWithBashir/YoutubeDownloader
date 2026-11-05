import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { attachSessionCookie, clearSessionCookie, ensureGuest } from "@/lib/session";
import { assertSameOrigin } from "@/lib/security";
import { purgeGuestData } from "@/lib/cleanup";
import { publicConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const guest = await ensureGuest(request);
    const response = jsonResponse({
      guestId: guest.guestId,
      mode: "guest",
      retentionHours: publicConfig().retentionHours,
    });
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const guest = await ensureGuest(request);
    const result = await purgeGuestData(guest.id);
    return clearSessionCookie(jsonResponse({ success: true, ...result }));
  } catch (error) {
    return handleApiError(error);
  }
}
