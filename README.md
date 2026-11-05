# Clearframe

Clearframe is a guest-first, legally authorized media conversion studio. Upload media you own, or import an authorized **direct media-file URL**, choose a video/audio output, and let a separate FFmpeg worker produce a real, signed, expiring download. There are no accounts, no registration, and no login gate.

> **Legal boundary:** Clearframe does not extract media from protected streaming pages, bypass DRM, circumvent access restrictions, scrape third-party streaming services, or download YouTube/social-media videos. Only user-owned, licensed, public-domain, or otherwise explicitly authorized media may be processed.

## What works

- Responsive light/dark interface with a landing page, workspace, live batch progress, history, dashboard, local settings, and policy pages.
- Drag-and-drop uploads and authorized direct media-file imports with an explicit rights confirmation.
- Real signature/MIME/extension validation, FFprobe metadata detection, and bounded FFmpeg conversion.
- MP4/WebM video output and MP3/WAV/AAC/FLAC audio output with resolution, quality, and bitrate presets.
- Persistent PostgreSQL records for guest sessions, media files, conversion jobs, outputs, and processing events.
- BullMQ/Redis queue when `REDIS_URL` is set; a persistent database-poller fallback when it is not.
- Signed, session-scoped, expiring downloads with range-capable local delivery or S3-compatible presigned URLs.
- Automatic retention cleanup, rate limits, SSRF/private-network guards, safe storage keys, and same-origin checks.

## Quick start with Docker Compose

Requires Docker with Compose v2. Copy the environment template, replace **both** secrets, then start the stack:

```bash
cp .env.example .env
# Edit SESSION_SECRET and ADMIN_TOKEN; use openssl rand -base64 48 for each.
docker compose up --build
```

Open `http://localhost:3000`. MinIO Console is available at `http://localhost:9001` using the development credentials in `.env`. Compose runs separate `web` and `worker` services, plus PostgreSQL, Redis/BullMQ, MinIO, bucket initialization, and SQL migrations.

To verify a real conversion against the running stack:

```bash
APP_URL=http://localhost:3000 npm run test:e2e
```

The smoke test creates an original WAV tone, uploads it, queues an MP3 job, waits for the worker, follows the signed redirect, and probes the downloaded MP3 with FFprobe.

## Development without Docker

A sandbox-friendly path uses embedded PostgreSQL, filesystem storage, and the database-poller mode:

```bash
npm ci
npm run prisma:generate
npm run db:embedded                 # keep this running; starts Postgres + applies migrations
```

In two other terminals, export the variables shown in [`docs/SETUP.md`](docs/SETUP.md) and run:

```bash
npm run dev
npm run worker
```

Then run `npm run test:e2e`. Full instructions, environment variables, architecture, and security notes live in [`docs/`](docs/).

## Verification status

Verified in this workspace: `npm run typecheck`, `npm run lint`, `npm test` (38 unit/API/worker/frontend/security tests), `npm run build`, engine-free SQL migration, a live embedded-Postgres app/worker run, and a real WAV → MP3 → signed-download end-to-end flow. See [`docs/SECURITY.md`](docs/SECURITY.md) for the remaining unverified integrations; this project is **not** presented as production-ready until Docker Compose, Redis/BullMQ, production S3 credentials, load testing, and operator/legal review are validated in the target environment.

## Documentation

- [`docs/SETUP.md`](docs/SETUP.md) — setup, services, environment variables, migrations, and commands.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — request flow, data model, queue modes, storage, and retention.
- [`docs/SECURITY.md`](docs/SECURITY.md) — security controls, tests, external credentials, and verification gaps.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — typecheck, lint, tests, and build on every push/PR.
