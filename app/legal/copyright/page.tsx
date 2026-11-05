import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Copyright policy",
  description: "The authorized-content boundary and copyright notice process for Clearframe deployments.",
};

const sections: LegalSection[] = [
  {
    id: "principle",
    title: "1. Core principle",
    paragraphs: [
      "Clearframe processes files, not protected web pages. Users may submit only media they own, have licensed, that is in the public domain, or that they are otherwise explicitly authorized to copy and transform.",
      "The application is not a YouTube downloader, social-media extractor, stream ripper or DRM circumvention tool. There is no feature that resolves a video page into downloadable media, parses HLS/DASH manifests, or bypasses access restrictions.",
    ],
  },
  {
    id: "technical-boundary",
    title: "2. Technical boundary",
    paragraphs: ["URL import is deliberately constrained:"],
    bullets: [
      "Only HTTP/HTTPS URLs to direct media-file bytes are accepted.",
      "Known streaming and social-media hosts are rejected before a request is made.",
      "Private, loopback, link-local, metadata and reserved network addresses are rejected, including DNS results and redirects.",
      "Playlists, manifests, HTML pages and non-media responses are rejected.",
      "Every response must pass file-signature, MIME-type and FFprobe validation before storage.",
    ],
  },
  {
    id: "representations",
    title: "3. User responsibility",
    paragraphs: [
      "A user must confirm authorization before submitting a conversion batch. That confirmation is a representation that the user has the necessary rights for both the source and the output, including any audio extracted from a video.",
      "Copyright ownership is not transferred by conversion. Metadata stripping or format changes do not remove underlying rights, and outputs remain subject to the permissions that apply to the source.",
    ],
  },
  {
    id: "notice",
    title: "4. Copyright notices",
    paragraphs: [
      "A rights holder who believes material in a specific deployment infringes their copyright should contact the operator of that deployment through its published channel. The software project does not operate every deployment and cannot delete objects from a database it does not control.",
      "A useful notice should identify the copyrighted work, the specific job or output identifier if available, the location or URL of the material within the deployment, the complainant's relationship to the rights, a good-faith belief statement, and contact information. Operators should evaluate notices under the law that applies to them.",
    ],
  },
  {
    id: "operator-action",
    title: "5. Operator response",
    paragraphs: [
      "Depending on the deployment and applicable law, an operator may disable a signed download, expire the associated output, cancel active jobs, preserve minimal records needed to evaluate the claim, or restrict repeat misuse where technically feasible.",
      "Because guest sessions are anonymous, operators should avoid collecting more identity information than necessary and should document any temporary access restriction in their own operational policy.",
    ],
  },
  {
    id: "repeat-misuse",
    title: "6. Repeat misuse",
    paragraphs: [
      "Repeated attempts to import protected streaming pages, bypass access controls, disguise prohibited content or submit unauthorized material are inconsistent with the permitted-use terms. Operators may rate-limit or block abusive traffic and should apply a documented repeat-misuse policy appropriate to their jurisdiction.",
    ],
  },
  {
    id: "counter-notice",
    title: "7. Counter-notice and restoration",
    paragraphs: [
      "Where applicable law provides a counter-notice process, the operator should publish the required form and restoration timeline. Clearframe's temporary retention may mean an expired object cannot be restored even if a claim is withdrawn; users should keep their original source files.",
    ],
  },
  {
    id: "no-legal-advice",
    title: "8. No legal advice",
    paragraphs: [
      "This policy is a product boundary and implementation template, not legal advice. Operators should obtain jurisdiction-specific advice, name a designated notice contact, and adapt this document before offering the application to end users.",
    ],
  },
];

export default function CopyrightPage() {
  return (
    <LegalPage
      eyebrow="Copyright policy"
      title="Rights stay with the source"
      summary="Conversion changes a file's format, not its ownership. Clearframe's architecture and policies are intentionally narrow to keep unauthorized extraction out of scope."
      sections={sections}
    />
  );
}
