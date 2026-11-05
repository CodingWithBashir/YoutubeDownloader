import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureRedis, hasRedis } from "@/lib/redis";

export interface WorkerHeartbeat {
  workerId: string;
  mode: "bullmq" | "database-poller";
  timestamp: string;
  pid: number;
}

const HEARTBEAT_KEY = "clearframe:worker:heartbeat";
const HEARTBEAT_FILE = path.resolve(process.cwd(), "tmp", "worker-heartbeat.json");

export async function writeWorkerHeartbeat(heartbeat: WorkerHeartbeat) {
  const serialized = JSON.stringify(heartbeat);
  if (hasRedis()) {
    await ensureRedis().then((redis) => redis.set(HEARTBEAT_KEY, serialized, "EX", 30));
    return;
  }
  await mkdir(path.dirname(HEARTBEAT_FILE), { recursive: true });
  await writeFile(HEARTBEAT_FILE, serialized, "utf8");
}

export async function readWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  try {
    const serialized = hasRedis()
      ? await ensureRedis().then((redis) => redis.get(HEARTBEAT_KEY))
      : await readFile(HEARTBEAT_FILE, "utf8");
    if (!serialized) return null;
    return JSON.parse(serialized) as WorkerHeartbeat;
  } catch {
    return null;
  }
}
