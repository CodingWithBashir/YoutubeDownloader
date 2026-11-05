import { publicConfig } from "@/lib/env";
import { jsonResponse } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse(publicConfig());
}
