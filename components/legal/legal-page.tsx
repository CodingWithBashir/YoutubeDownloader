import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Badge, Container } from "@/components/ui/primitives";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export function LegalPage({
  eyebrow,
  title,
  summary,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Clearframe
        </Link>

        <div className="mt-8 grid gap-10 border-b border-line/80 pb-10 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted">{summary}</p>
          </div>
          <div className="rounded-3xl border border-line bg-surface/70 p-5">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand" /><p className="text-xs font-bold text-ink">Policy status</p></div>
            <p className="mt-3 text-xs leading-6 text-muted">Last reviewed 3 November 2026. This document describes the self-hosted Clearframe application, not a hosted service operated by the software authors.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Authorized media only</Badge>
              <Badge tone="neutral">No accounts</Badge>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr] lg:items-start">
          <nav className="hidden lg:sticky lg:top-28 lg:block" aria-label="On this page">
            <p className="eyebrow">On this page</p>
            <ul className="mt-4 space-y-2.5">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="flex gap-2 text-xs leading-5 text-muted hover:text-brand">
                    <span className="font-mono text-line">{String(index + 1).padStart(2, "0")}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-7 border-t border-line pt-5">
              <p className="eyebrow">Related policies</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li><Link href="/legal/terms" className="text-muted hover:text-brand">Terms of service</Link></li>
                <li><Link href="/legal/privacy" className="text-muted hover:text-brand">Privacy</Link></li>
                <li><Link href="/legal/copyright" className="text-muted hover:text-brand">Copyright policy</Link></li>
              </ul>
            </div>
          </nav>

          <article className="prose-legal max-w-3xl">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
              </section>
            ))}
            <div className="mt-12 rounded-2xl border border-line bg-surface/70 p-5 text-xs leading-6 text-muted">
              <strong>Note:</strong> This template is provided for informational purposes and is not legal advice. The operator of each deployment should review it with qualified counsel and add the contact channel and jurisdiction that apply to that deployment.
            </div>
          </article>
        </div>
      </Container>
    </div>
  );
}
