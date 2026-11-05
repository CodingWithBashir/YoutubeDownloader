import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { applySqlMigrations } from "./apply-sql-migrations.mjs";

const dataDir = process.env.PG_DATA_DIR || "/tmp/clearframe-pgdata";
const port = Number(process.env.PGPORT || 55432);
const database = process.env.PGDATABASE || "clearframe";
const user = process.env.PGUSER || "clearframe";
const password = process.env.PGPASSWORD || "clearframe";

const postgres = new EmbeddedPostgres({
  databaseDir: path.resolve(dataDir),
  user,
  password,
  port,
  persistent: true,
  autoRehydrateSymlinks: true,
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop().catch(() => undefined);
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await postgres.initialise();
await postgres.start();
try {
  await postgres.createDatabase(database);
} catch (error) {
  if (!/already exists/i.test(String(error?.message || error))) throw error;
}

const client = new Client({ host: "127.0.0.1", port, user, password, database });
await client.connect();
try {
  await applySqlMigrations(client);
} finally {
  await client.end();
}

console.log(`[db] embedded Postgres ready on 127.0.0.1:${port}/${database}`);
setInterval(() => undefined, 1_000_000_000);
