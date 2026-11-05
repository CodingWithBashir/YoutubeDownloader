import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/api-helpers";
import { ADMIN_HEADER, adminOverview, assertAdminRequest } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { cleanupWithLock } from "@/lib/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertAdminRequest(request);
    await rateLimit(request, "admin", request.headers.get(ADMIN_HEADER) || "admin");
    return jsonResponse(await adminOverview());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    assertAdminRequest(request);
    await rateLimit(request, "admin", request.headers.get(ADMIN_HEADER) || "admin");
    return jsonResponse(await cleanupWithLock());
  } catch (error) {
    return handleApiError(error);
  }
}
