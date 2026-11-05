import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  clearframePrisma?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({
    adapter,
    log: env.isProduction ? ["warn", "error"] : ["error", "warn"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.clearframePrisma) {
    globalForPrisma.clearframePrisma = createClient();
  }
  return globalForPrisma.clearframePrisma;
}

// Keep the database client lazy: Next.js must be able to collect route metadata
// at build time without a live DATABASE_URL, and tests can mock the boundary.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
});
