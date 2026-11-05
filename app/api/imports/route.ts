import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import { ApiError, handleApiError } from "@/lib/errors";
import { parseJson, jsonResponse } from "@/lib/api-helpers";
import { urlImportSchema } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/security";
import { attachSessionCookie, ensureGuest, getSessionFromRequest } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { fetchAuthorizedDirectMedia } from "@/lib/url-guard";
import { ingestMediaFile } from "@/lib/media/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let directory: string | undefined;
  try {
    assertSameOrigin(request);
    const body = await parseJson(request, urlImportSchema);
    const session = getSessionFromRequest(request);
    await rateLimit(request, "imports", session.guestId);
    const guest = await ensureGuest(request);

    directory = await mkdtemp(path.join(os.tmpdir(), "clearframe-import-"));
    const filePath = path.join(directory, "source.media");
    const imported = await fetchAuthorizedDirectMedia(body.url, filePath);
    const media = await ingestMediaFile({
      userId: guest.id,
      filePath,
      filename: imported.filename,
      declaredMime: imported.contentType,
      sourceDomain: imported.hostname,
    });
    const response = jsonResponse({ media }, 201);
    return attachSessionCookie(response, guest.session);
  } catch (error) {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof ApiError || (error instanceof Error && ["MediaValidationError", "UrlImportError"].includes(error.name))) {
      return handleApiError(error);
    }
    return handleApiError(error);
  }
}
