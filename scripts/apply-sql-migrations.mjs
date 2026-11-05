import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "prisma", "migrations");

export async function applySqlMigrations(client, { logger = console } = {}) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  const entries = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of entries) {
    const existing = await client.query(
      `SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "rolled_back_at" IS NULL LIMIT 1`,
      [name],
    );
    if (existing.rowCount) {
      logger.log(`[db] migration already applied: ${name}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations"
          ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
         VALUES ($1, $2, now(), $3, 1)`,
        [randomUUID(), checksum, name],
      );
      await client.query("COMMIT");
      logger.log(`[db] applied migration: ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to apply migrations.");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await applySqlMigrations(client);
  } finally {
    await client.end();
  }
}
