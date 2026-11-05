import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Clearframe stores, why it stores it, and how temporary guest data is retained.",
};

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    paragraphs: [
      "Clearframe does not require an account, email address, password or profile. It uses a signed anonymous session to associate temporary media and conversion records with the browser that created them.",
      "This page describes a default self-hosted deployment. The operator controls the actual database, Redis instance, object storage, logs and retention configuration.",
    ],
  },
  {
    id: "collected",
    title: "2. Data the application processes",
    paragraphs: ["To provide the conversion workflow, the application processes:"],
    bullets: [
      "Uploaded or imported media bytes and their detected container, codecs, duration, dimensions, size and SHA-256 hash.",
      "A sanitized display filename and, for direct URL imports, only the verified hostname — not the full URL, query string or credentials.",
      "Generated thumbnails, waveform images, short previews and conversion outputs.",
      "Conversion settings, statuses, progress values and processing events.",
      "An opaque guest-session identifier in a signed HttpOnly cookie, and a hashed client address for rate limiting.",
    ],
  },
  {
    id: "cookies",
    title: "3. Cookies and local preferences",
    paragraphs: [
      "The guest-session cookie is HttpOnly, SameSite=Lax, signed with SESSION_SECRET, and marked Secure in production. It is required to access files and jobs created by that browser session; it is not used for advertising or cross-site tracking.",
      "Theme and conversion defaults are stored in this browser's localStorage. They are not sent to the server and can be removed through browser settings or the Settings page. The admin access key, if used, is held only in sessionStorage for the current tab.",
    ],
  },
  {
    id: "usage",
    title: "4. Why data is used",
    paragraphs: ["Data is used only to:"],
    bullets: [
      "Validate file signatures, MIME types and metadata before processing.",
      "Convert media with the requested format and quality preset.",
      "Display accurate progress, errors, history and download links.",
      "Enforce ownership, rate limits, resource limits and signed-download expiry.",
      "Operate, troubleshoot and clean up the deployment.",
    ],
  },
  {
    id: "sharing",
    title: "5. Storage providers and disclosure",
    paragraphs: [
      "PostgreSQL stores relational records; Redis/BullMQ coordinates jobs; S3-compatible object storage or the development filesystem adapter stores media bytes. These are infrastructure components configured by the operator, not advertising or data-broker services.",
      "The application does not send media to streaming platforms or scrape third-party services. It does not sell personal data. The operator may disclose information when legally required, and should publish the contact channel and legal basis applicable to the deployment.",
    ],
  },
  {
    id: "retention",
    title: "6. Retention and deletion",
    paragraphs: [
      "The default retention window is 24 hours and is configurable through RETENTION_HOURS. A worker cleanup task deletes expired source objects, previews, thumbnails and outputs, marks media records expired, and removes expired output records.",
      "Download links are shorter-lived and signed. You can use Settings → Clear guest data to request immediate deletion of the objects and records associated with the current guest session and to clear the cookie. Temporary worker files are removed after each job or validation step.",
    ],
  },
  {
    id: "security",
    title: "7. Security practices",
    paragraphs: ["Implemented safeguards include:"],
    bullets: [
      "Signature and MIME validation, file-size and duration limits, and bounded FFprobe/FFmpeg timeouts.",
      "SSRF screening for private/reserved IP addresses, unsafe redirects and streaming-page hosts.",
      "Fixed argument arrays for FFmpeg and FFprobe rather than shell command strings.",
      "Ownership checks on every media record, job, asset and download.",
      "Rate limiting, same-origin checks for state-changing requests, HMAC-signed guest sessions and short-lived signed links.",
    ],
  },
  {
    id: "choices",
    title: "8. Your choices and rights",
    paragraphs: [
      "You can avoid URL imports, use only local files, clear guest data, delete cookies, and reset local preferences. Because no account exists, there is no profile to view or correct.",
      "Rights requests that require identifying a record should be sent through the contact channel published by the operator of this deployment. Operators should align this section with the privacy law and jurisdiction that applies to them.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Temporary by default"
      summary="No profiles, no ad tracking and no permanent media library. Clearframe stores only what a real conversion workflow needs, then expires it."
      sections={sections}
    />
  );
}
