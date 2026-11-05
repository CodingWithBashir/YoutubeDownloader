# Setup

Clearframe separates the Next.js web app from the FFmpeg media worker. PostgreSQL is the source of truth; Redis/BullMQ is the preferred queue; S3-compatible storage is used in Compose. None of these services require a user account in the product.

## 1. Docker Compose (recommended local environment)

1. Install Docker with Compose v2.
2. `cp .env.example .env`
3. Generate and set two distinct secrets:

   ```bash
   openssl rand -base64 48   # SESSION_SECRET
   openssl rand -hex 32      # ADMIN_TOKEN
   ```

4. `docker compose up --build`

Services:

| Service | Purpose |
| --- | --- |
| `web` | Next.js App Router and API routes on port 3000 |
| `worker` | Separate `tsx worker/index.ts` FFmpeg process |
| `postgres` | PostgreSQL 16 with a persistent volume |
| `redis` | Redis 7 for BullMQ, cancellation pub/sub, and distributed rate limits |
| `minio` | S3-compatible object storage; Console on port 9001 |
| `minio-init` | Creates the configured bucket |
| `db-migrate` | Applies `prisma/migrations/*/migration.sql` idempotently |

Compose overrides `DATABASE_URL`, `REDIS_URL`, and `S3_ENDPOINT` to service names. Keep the values in `.env.example` for standalone development.

## 2. Standalone development (no Docker)

The repository includes an embedded PostgreSQL runner for environments without system services. It is a development/verification aid, not a production database.

```bash
npm ci
npm run prisma:generate
npm run db:embedded
```

`db:embedded` starts PostgreSQL on `127.0.0.1:55432`, creates `clearframe`, and applies the SQL migrations. Keep it running. `PG_DATA_DIR`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` can override its defaults.

Create `.env.local` for Next.js:

```dotenv
APP_ORIGIN=http://localhost:3000
SESSION_SECRET=at-least-32-random-characters-from-openssl
ADMIN_TOKEN=a-separate-long-random-admin-key
DATABASE_URL=postgresql://clearframe:clearframe@127.0.0.1:55432/clearframe?schema=public
STORAGE_DRIVER=filesystem
LOCAL_STORAGE_ROOT=./storage
MAX_UPLOAD_BYTES=262144000
DOWNLOAD_URL_TTL_SECONDS=300
```

The **worker** does not load `.env.local` automatically. Export the same values in its shell before running:

```bash
export APP_ORIGIN=http://localhost:3000
export SESSION_SECRET=...
export ADMIN_TOKEN=...
export DATABASE_URL=postgresql://clearframe:clearframe@127.0.0.1:55432/clearframe?schema=public
export STORAGE_DRIVER=filesystem
export LOCAL_STORAGE_ROOT=./storage
unset REDIS_URL
npm run worker
```

Run the web app in another terminal:

```bash
npm run dev
```

With `REDIS_URL` unset, jobs are persisted as `QUEUED` and claimed by the worker's database poller. This is real processing, not simulated progress. Setting `REDIS_URL` switches to BullMQ; the same worker process handles both modes.

## 3. Prisma generation and migrations

`npm run prisma:generate` uses `engineType = "client"` and the generated WASM query compiler. The helper in `scripts/prisma-generate.mjs` points legacy engine variables at harmless placeholders and skips checksum downloads, so generation works offline without a native query-engine binary.

```bash
npm run prisma:generate
npm run prisma:migrate      # engine-free idempotent SQL migration runner
```

`npm run prisma:migrate:deploy` is retained for environments where Prisma's native schema engine is available. `npm run db:apply` is the same engine-free migration runner against `DATABASE_URL`.

## 4. Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `SESSION_SECRET` | yes | 32+ random characters; signs guest cookies and local object URLs |
| `DOWNLOAD_SECRET` | no | Optional separate HMAC key for object URLs; falls back to `SESSION_SECRET` |
| `ADMIN_TOKEN` | admin page | Deployment token for `/api/admin/overview`; not an account |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_ORIGIN` | recommended | Absolute public origin used for signed redirects and origin checks |
| `REDIS_URL` | optional | Enables BullMQ, cancellation pub/sub, and distributed rate limits |
| `STORAGE_DRIVER` | no | `s3` or `filesystem`; defaults to `filesystem` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | for S3 | S3-compatible endpoint and bucket |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | for S3 | S3-compatible credentials |
| `S3_FORCE_PATH_STYLE` | no | Usually `true` for MinIO |
| `LOCAL_STORAGE_ROOT` | filesystem mode | Root directory for local objects; keep it outside the public web root |
| `MAX_UPLOAD_BYTES`, `MAX_IMPORT_BYTES` | no | Per-file size caps |
| `MAX_BATCH_FILES` | no | Maximum files/conversions per batch |
| `MAX_MEDIA_DURATION_SECONDS`, `MAX_VIDEO_PIXELS` | no | Media resource limits |
| `FFPROBE_TIMEOUT_MS`, `FFMPEG_TIMEOUT_MS` | no | Bounded process timeouts |
| `FFMPEG_PATH`, `FFPROBE_PATH` | no | Absolute binary overrides; npm installer binaries are used by default |
| `RETENTION_HOURS` | no | Expiry for media and outputs |
| `DOWNLOAD_URL_TTL_SECONDS` | no | Signed-link lifetime, 30–3600 seconds |
| `WORKER_CONCURRENCY`, `WORKER_HEARTBEAT_SECONDS` | no | BullMQ worker concurrency and heartbeat |
| `RATE_LIMIT_*` | no | Per-window request limits |
| `APP_URL` | e2e only | Base URL for `npm run test:e2e` |

## 5. Commands

```bash
npm run dev              # Next.js dev server on 0.0.0.0
npm run worker           # separate FFmpeg worker
npm run typecheck        # app + test TypeScript projects
npm run lint             # ESLint with zero warnings allowed
npm test                 # Vitest unit/API/worker/frontend/security suite
npm run build            # production Next.js build
npm run check            # typecheck + lint + test + build
npm run test:e2e         # live upload → worker → signed download smoke test
npm run db:embedded      # embedded PostgreSQL + migrations
npm run db:apply         # apply SQL migrations to DATABASE_URL
```

## 6. External credential integrations

Local Compose supplies development-only PostgreSQL, Redis, and MinIO credentials. A real deployment needs operator-managed secrets for PostgreSQL, Redis, and an S3-compatible bucket, plus a real `SESSION_SECRET`, `DOWNLOAD_SECRET`, and `ADMIN_TOKEN`. Do not use the Compose development passwords in production. Legal/operator contact details in the policy pages are templates and must be completed before public operation.
