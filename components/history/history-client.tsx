"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Download,
  FileDown,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar, Skeleton, StatusPill } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePolling } from "@/components/hooks/use-polling";
import { apiFetch, queryString } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatBytes, formatDate } from "@/lib/format";
import type { JobDTO, JobStatus } from "@/lib/types";

interface HistoryResponse {
  jobs: JobDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const filters: Array<{ label: string; value: JobStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Queued", value: "QUEUED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
  { label: "Canceled", value: "CANCELED" },
];

export function HistoryClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [busyJob, setBusyJob] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const url = useMemo(
    () =>
      `/api/history${queryString({
        q: debouncedQuery || null,
        status: status === "ALL" ? null : status,
        page,
        limit: 12,
      })}`,
    [debouncedQuery, status, page],
  );
  const { data, error, loading, refresh } = usePolling<HistoryResponse>(url, { intervalMs: 4000 });

  const cancel = async (job: JobDTO) => {
    setBusyJob(job.id);
    try {
      await apiFetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      toast("Cancellation requested", "The job state was updated and the worker was notified.", "info");
      refresh();
    } catch (caught) {
      toast("Could not cancel", caught instanceof Error ? caught.message : undefined, "error");
    } finally {
      setBusyJob(null);
    }
  };

  const retry = async (job: JobDTO) => {
    setBusyJob(job.id);
    try {
      const response = await apiFetch<{ batchId: string }>(`/api/jobs/${job.id}/retry`, { method: "POST" });
      toast("Retry queued", "A new batch was created for this conversion.", "success");
      router.push(`/progress/${response.batchId}`);
    } catch (caught) {
      toast("Could not retry", caught instanceof Error ? caught.message : undefined, "error");
    } finally {
      setBusyJob(null);
    }
  };

  const exportPage = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `clearframe-history-page-${data.page}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    toast("Export ready", "The currently loaded history page was saved as JSON.", "success");
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 border-b border-line/80 pb-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Conversion history</p>
            <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">Every job, accounted for</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              Search, filter, cancel queued work, retry failures and request fresh signed links for completed outputs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportPage} disabled={!data?.jobs.length}>
            <FileDown className="h-4 w-4" /> Export this page
          </Button>
        </div>

        <Card className="mt-8 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search file names or presets"
                className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
                aria-label="Search conversion history"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setStatus(filter.value);
                    setPage(1);
                  }}
                  className={cn(
                    "whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    status === filter.value ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:text-ink",
                  )}
                  aria-pressed={status === filter.value}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {error && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
          </div>
        )}

        {loading && !data ? (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-3xl" />)}
          </div>
        ) : data && data.jobs.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No matching conversions"
              description={query || status !== "ALL" ? "Try a different search term or status filter." : "Completed and active jobs for this guest session will appear here."}
              action={<Link href="/#start"><Button>Start a conversion</Button></Link>}
            />
          </div>
        ) : data ? (
          <>
            <div className="mt-6 space-y-4">
              {data.jobs.map((job) => {
                const canCancel = ["QUEUED", "PROCESSING"].includes(job.status);
                const canRetry = ["FAILED", "CANCELED"].includes(job.status);
                return (
                  <Card key={job.id} className="p-5 sm:p-6">
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={job.status} />
                          <Badge tone="neutral">{job.targetFormat}</Badge>
                          <Badge tone="brand">{job.presetLabel}</Badge>
                        </div>
                        <h2 className="mt-3 truncate text-base font-bold text-ink" title={job.media?.displayName}>{job.media?.displayName || "Source media"}</h2>
                        <p className="mt-1 text-xs text-muted">
                          {formatDate(job.createdAt)} · {job.media?.durationSeconds ? `${Math.round(job.media.durationSeconds)}s source` : "source duration unavailable"} · attempts {job.attempts}
                        </p>
                        {job.status === "PROCESSING" && (
                          <div className="mt-4 max-w-md">
                            <ProgressBar value={job.progress} tone="teal" />
                            <p className="mt-1.5 text-[11px] text-muted">{job.stage} · {Math.round(job.progress)}% measured</p>
                          </div>
                        )}
                        {job.errorMessage && <p className="mt-3 text-xs text-danger"><strong>{job.errorCode}:</strong> {job.errorMessage}</p>}
                        {job.outputs.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {job.outputs.map((output) => (
                              <a key={output.id} href={`/api/outputs/${output.id}/download`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 text-xs font-semibold text-ink transition hover:border-brand/40">
                                <Download className="h-3.5 w-3.5 text-brand" />
                                <span className="max-w-[220px] truncate">{output.fileName}</span>
                                <span className="text-muted">{formatBytes(output.sizeBytes)}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link href={`/progress/${job.batchId}`}><Button variant="outline" size="sm">Details</Button></Link>
                        {canCancel && (
                          <Button variant="ghost" size="sm" disabled={busyJob === job.id} onClick={() => cancel(job)}>
                            <Ban className="h-4 w-4" /> Cancel
                          </Button>
                        )}
                        {canRetry && (
                          <Button variant="soft" size="sm" disabled={busyJob === job.id} onClick={() => retry(job)}>
                            <RotateCcw className="h-4 w-4" /> Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t border-line/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                {data.total} total {data.total === 1 ? "job" : "jobs"} · page {data.page} of {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
