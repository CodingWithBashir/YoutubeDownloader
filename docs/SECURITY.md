# Security notes and verification

## Implemented controls

- **Authorized-use boundary:** known streaming/social hosts are rejected; imports require a direct media-file URL and an explicit authorization confirmation. No DRM or access-restriction bypass is implemented.
- **Guest ownership:** signed anonymous cookies, HTTP-only in production, scope all media, jobs, history, and downloads. There are no passwords or account credentials.
- **SSRF protection:** `lib/url-guard.ts` restricts protocols/ports/extensions, rejects credentials and streaming pages, resolves DNS, validates every address, and blocks redirects. Private, loopback, link-local, metadata, and reserved ranges are denied.
- **File validation:** `lib/signatures.ts` checks real container headers against MIME type and extension; FFprobe confirms decodable streams; size, duration, pixel count, and process timeouts are bounded.
- **Safe execution:** FFmpeg/FFprobe are spawned with argument arrays, no shell interpolation, bounded output, abort signals, and validated enums/numbers.
- **Object safety:** storage keys and filenames are sanitized; local delivery verifies HMAC expiry and guest ownership, supports ranges, and uses `nosniff`/private cache headers. S3 delivery uses presigned URLs.
- **Abuse controls:** same-origin checks on state changes, per-guest rate limits, batch limits, worker concurrency, cancellation, and retention cleanup.
- **Headers:** CSP, referrer policy, COOP/CORP, permissions policy, HSTS, and `nosniff`. The CSP permits Arena's `*.e2b.app` preview frame in addition to same-origin embedding.
- **Secrets:** no credentials are committed; `.env` and `.env.local` are ignored. Compose development credentials are explicitly labelled development-only.

## Automated checks

`npm test` covers signature/MIME mismatch, private-IP and streaming URL rejection, signed session/object tampering, cross-origin requests, download ownership, invalid storage signatures, preset/argument validation, real WAV→MP3 and WAV→FLAC conversion, worker eligibility, theme/FAQ/URL-form behavior, and generated demo media. `npm run test:e2e` exercises a live upload, persistent job, FFmpeg worker, signed redirect, and FFprobe verification of the downloaded MP3.

Run all local verification:

```bash
npm run check
npm run test:e2e   # with web + worker + database running
```

## Verified in this sandbox

- TypeScript typecheck for app and test projects.
- ESLint with `--max-warnings=0`.
- Production `next build`.
- 38 Vitest tests across unit, API, worker, frontend, and security boundaries.
- Engine-free SQL migrations on embedded PostgreSQL.
- Live web/worker run with a real WAV → MP3 conversion and 2.06-second FFprobe-verified signed download.

## Not yet verified / operator responsibilities

- Docker Compose could not be executed here because the sandbox has no Docker daemon; the Compose file and Dockerfile are provided but require a real Docker validation run.
- Redis/BullMQ, MinIO/S3 presigned delivery, and distributed rate limits were not exercised here; sandbox verification used the database poller and filesystem adapter.
- Production-managed PostgreSQL, Redis, and S3 credentials, TLS termination, backups, monitoring, horizontal worker scaling, and load testing still need target-environment validation.
- Policy pages contain template operator contact/jurisdiction text and are not legal advice; complete them and obtain legal review before public operation.
- `ADMIN_TOKEN` protects the operational overview only; it is not a user account or an authorization boundary for conversion.

**Do not treat this checkout as production-ready until the above external integrations and security checks pass in the deployment environment.**
