import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage, storageDriver } from "@/lib/storage";
import { ensureRedis, hasRedis } from "@/lib/redis";
import { queueMode } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }
  try {
    if (hasRedis()) await ensureRedis().then((redis) => redis.ping());
    checks.redis = hasRedis() ? "ok" : "standalone";
  } catch {
    checks.redis = "error";
  }
  try {
    await getStorage().ping();
    checks.storage = "ok";
  } catch {
    checks.storage = "error";
  }
  const healthy = checks.database === "ok" && checks.storage === "ok" && checks.redis !== "error";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, queueMode, storageDriver: storageDriver() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
