import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft text-brand"><Compass className="h-7 w-7" /></div>
      <p className="eyebrow mt-8">404 · Not found</p>
      <h1 className="display-type mt-3 text-5xl font-medium tracking-tight text-ink">This frame is missing.</h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-muted">The page may have moved, or the signed object may have expired. Your media and jobs remain private to your guest session.</p>
      <Link href="/" className="mt-8"><Button><ArrowLeft className="h-4 w-4" /> Return home</Button></Link>
    </Container>
  );
}
