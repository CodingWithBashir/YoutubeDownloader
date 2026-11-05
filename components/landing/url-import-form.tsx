"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Link2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { looksLikeDirectMediaUrl, looksLikeStreamingPage } from "@/lib/public-url-check";
import type { MediaDTO, PublicConfig } from "@/lib/types";

export function UrlImportForm({ config, onSuccess }: { config: PublicConfig | null; onSuccess: (media: MediaDTO[]) => void }) {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!looksLikeDirectMediaUrl(url)) {
      setError("Enter an absolute http or https URL to a direct media file.");
      return;
    }
    if (looksLikeStreamingPage(url)) {
      setError("Streaming and social-media pages are not supported. Use a direct media-file URL you are authorized to process.");
      return;
    }
    if (!authorized) {
      setError("Confirm that you own or are explicitly authorized to process this file.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ media: MediaDTO }>("/api/imports", {
        method: "POST",
        body: JSON.stringify({ url, authorized: true }),
      });
      onSuccess([response.media]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The URL could not be imported.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-line bg-surface-2/40 p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-teal">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-2xl font-medium tracking-tight text-ink">Import a direct media file</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Paste a URL that returns the actual file bytes, such as an authorized <code className="font-mono text-xs">.mp4</code> or <code className="font-mono text-xs">.wav</code> asset.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="direct-media-url">Direct media file URL</label>
        <input
          id="direct-media-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://assets.example.org/my-licensed-clip.mp4"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={loading || !url} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? "Validating" : "Continue"}
        </Button>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line/80 bg-surface/70 p-3.5">
        <input
          type="checkbox"
          checked={authorized}
          onChange={(event) => setAuthorized(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]"
        />
        <span className="text-xs leading-5 text-muted">
          <strong className="font-semibold text-ink">I own this file or have explicit permission to process it.</strong> I understand that streaming pages, playlists, private-network addresses and redirects to unsafe hosts are rejected.
        </span>
      </label>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-muted">
        DNS results are screened for private and reserved addresses, redirects are manually validated, and the response must pass media signature checks. Maximum import size: {config ? `${Math.round(config.maxUploadBytes / 1024 / 1024)} MB` : "configured by the server"}.
      </p>
    </form>
  );
}
