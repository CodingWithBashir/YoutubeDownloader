import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms for using Clearframe to process legally authorized media.",
};

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "1. Scope of the service",
    paragraphs: [
      "Clearframe is a self-hosted media conversion application. It accepts user-supplied video and audio files or direct media-file URLs, detects metadata, converts selected files with FFmpeg, and provides temporary downloads of the resulting outputs.",
      "The software is designed for user-owned, licensed, public-domain, or otherwise explicitly authorized content. Each deployment is operated independently by the person or organization that configures it. These terms describe use of that deployment.",
    ],
  },
  {
    id: "no-account",
    title: "2. Guest sessions instead of accounts",
    paragraphs: [
      "No registration or login is required. When media is added, the application creates a signed, HttpOnly guest-session cookie containing an opaque identifier. That identifier associates media records, conversion jobs, processing events and outputs with the current browser session.",
      "The cookie is not a universal identity and does not allow access from another device. Clearing browser cookies normally ends access to that session's records. Settings also provide an explicit action to clear guest data.",
    ],
  },
  {
    id: "permitted-use",
    title: "3. Permitted use and your representations",
    paragraphs: ["By uploading or importing media, you represent that:"],
    bullets: [
      "You own the content, it is public domain, or you have explicit permission to copy and transform it.",
      "Processing and distributing the output will not infringe copyright, privacy, publicity, contractual or other rights.",
      "The source is a direct media file rather than a protected streaming page, playlist, manifest or third-party service response.",
      "You will not use the service to evade technical protection measures, access controls, paywalls, geographic restrictions or authentication.",
    ],
  },
  {
    id: "prohibited",
    title: "4. Prohibited activity",
    paragraphs: ["The following uses are outside the product's design and are not permitted:"],
    bullets: [
      "Downloading or extracting media from YouTube, social networks, subscription platforms or other protected streaming pages.",
      "Circumventing DRM, encryption, tokens, signed access restrictions or rate controls imposed by a rights holder.",
      "Scraping HLS/DASH manifests, playlists or third-party media catalogs.",
      "Uploading malware, scripts, archives, executables, documents or files disguised with a media extension.",
      "Using the deployment to attack private networks, metadata services or infrastructure through URL imports.",
      "Attempting to exceed configured resource limits or interfere with other users' jobs and downloads.",
    ],
  },
  {
    id: "processing",
    title: "5. Real processing, failure and availability",
    paragraphs: [
      "Conversion jobs are persisted in PostgreSQL and processed by a separate FFmpeg worker. Progress is derived from actual FFmpeg output. The application does not create simulated completed conversions.",
      "A job can fail because the source is unsupported, expires, exceeds configured limits, or because the queue, worker, database or object storage is unavailable. Failures are displayed with an error code and processing event; successful outputs are never fabricated.",
      "The operator may change limits, retention windows, storage providers and worker capacity. The public configuration endpoint reports the active limits for a deployment.",
    ],
  },
  {
    id: "retention",
    title: "6. Temporary files and downloads",
    paragraphs: [
      "Source objects, generated thumbnails, previews and conversion outputs are temporary. A scheduled cleanup removes expired objects and marks media records expired. Download links are generated on demand, checked against guest-session ownership, and expire independently of the file retention window.",
      "You are responsible for downloading outputs before expiration. Once cleanup runs, an output cannot be reconstructed from the job record.",
    ],
  },
  {
    id: "privacy",
    title: "7. Privacy and policies",
    paragraphs: [
      "The Privacy page explains the limited data the application stores. The Copyright page describes the authorized-content boundary and repeat-misuse handling. Those policies form part of these terms.",
    ],
  },
  {
    id: "disclaimer",
    title: "8. Disclaimer and limitation",
    paragraphs: [
      "The software is provided by its deployment operator as-is. Output quality, codec availability and processing time depend on the source file, installed FFmpeg build and configured infrastructure. Always keep an original copy of important media.",
      "To the extent permitted by law, the operator is not liable for indirect losses, lost content after the published retention window, or unlawful use by a person submitting media. Nothing in these terms grants rights to content that the user does not already have.",
    ],
  },
  {
    id: "changes",
    title: "9. Changes and contact",
    paragraphs: [
      "The operator may update these terms as the deployment changes. The review date at the top of the page identifies the current version. For notices or questions, use the contact channel published by the operator of this deployment; the software project does not collect a global support address.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of service"
      title="Clear rules for a focused tool"
      summary="Clearframe exists to transform files you are authorized to use. These terms set out the boundary between legitimate media processing and prohibited extraction."
      sections={sections}
    />
  );
}
