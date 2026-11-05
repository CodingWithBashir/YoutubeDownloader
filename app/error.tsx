"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[clearframe] Unhandled UI error", error);
  }, [error]);
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-danger/10 text-danger"><CircleAlert className="h-7 w-7" /></div>
      <h1 className="display-type mt-8 text-4xl font-medium tracking-tight text-ink">Something stopped rendering.</h1>
      <p className="mt-4 max-w-lg text-sm leading-7 text-muted">The interface hit an unexpected error. No conversion was marked complete on your behalf. Retry the view, or return to the workspace.</p>
      {error.digest && <p className="mt-3 font-mono text-[11px] text-muted">Reference: {error.digest}</p>}
      <Button className="mt-8" onClick={reset}><RotateCcw className="h-4 w-4" /> Try again</Button>
    </Container>
  );
}
