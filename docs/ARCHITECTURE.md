# Architecture

## Product model

Clearframe is guest-first. A signed, HTTP-only cookie identifies an anonymous guest; `User` rows keyed by `guestId` provide ownership and history without registration. Account/admin pages never gate conversion. The admin dashboard is a deployment-token overview, not a login role.

## Request flow

```text
Browser
  │
  ├─ upload multipart ──► /api/uploads ──► signature + FFprobe + SHA-256
  │                                      ──► object storage ──► MediaFile row
  │
  ├─ authorized direct URL ► /api/imports ► SSRF guard ► bounded fetch ► same ingest
  │
  ├─ POST /api/jobs ─────► validate presets + ownership ──► ConversionJob rows
  │                                      ├─ BullMQ/Redis when REDIS_URL is set
  │                                      └─ QUEUED DB rows otherwise
  │
  ├─ GET /api/batches/:id ► persisted jobs, events, progress, outputs
  │
  └─ GET /api/outputs/:id/download ► ownership check ► HMAC/presigned URL
                                   ► range-capable object delivery
```

A separate `worker` process claims jobs, re-probes the source, runs an abortable FFmpeg conversion with real progress, validates the output signature, stores the result, writes `ProcessingEvent` records, creates a `ConversionOutput`, and marks the job `COMPLETED`. It also writes a heartbeat and runs retention cleanup. No completed conversion is fabricated in the UI.

## Data model

`prisma/schema.prisma` defines related PostgreSQL tables and enums:

- `User` — anonymous guest principal keyed by unique `guestId`.
- `MediaFile` — original object key, metadata, hashes, preview/thumbnail keys, owner, status, expiry.
- `ConversionJob` — target format, normalized settings, batch, status, progress, stage, attempts, worker, timestamps.
- `ConversionOutput` — output object key, MIME type, size, hash, duration, download count, expiry.
- `ProcessingEvent` — append-only operational timeline for a job.

Foreign keys cascade from users to media/jobs, and indexes support history, batch lookups, queue polling, and expiry cleanup. `scripts/apply-sql-migrations.mjs` applies the checked-in SQL and records it in `_prisma_migrations`.

## Queue modes

- **BullMQ mode:** `REDIS_URL` is set. Jobs are enqueued with deterministic IDs; the worker subscribes to cancellation messages, removes queued jobs on cancel, and exposes queue metrics.
- **Database-poller mode:** `REDIS_URL` is unset. The worker polls eligible `QUEUED` rows and uses the same claim/process/complete path. This made a real end-to-end run possible in a sandbox without a Redis server binary; it is not a mock.

## Storage

`StorageAdapter` has two implementations. The filesystem adapter is for local development and uses signed `/api/storage/[...key]` URLs with HMAC expiry, guest ownership checks, and byte ranges. The S3 adapter uses presigned `GetObject` URLs with a response content disposition and no public bucket access. Object keys are sanitized and never derived from unsanitized user paths.

## Security and retention

State-changing API routes enforce same-origin requests and per-guest rate limits. URL imports restrict schemes/ports/extensions, reject known streaming hosts, resolve DNS, and block private, loopback, link-local, metadata, and reserved IPs. Uploads validate file signatures, MIME types, extensions, size, duration, and pixel count. FFmpeg arguments are arrays of validated values, never shell strings. Downloads are scoped to the guest session and expire. Retention cleanup removes expired objects and marks records unavailable. See `docs/SECURITY.md`.

## UI

The App Router landing page, workspace, progress page, dashboard, history, settings, admin overview, and legal pages share a CSS-variable theme system, reusable primitives, toasts, polling hooks, and local device settings. Polling stops on terminal job states. No account route is part of the core workflow.
