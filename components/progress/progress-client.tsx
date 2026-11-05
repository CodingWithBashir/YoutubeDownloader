"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clipboard,
  Download,
  FileClock,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, ProgressBar, Skeleton, StatusPill } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePolling } from "@/components/hooks/use-polling";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatBytes, formatDate, percent } from "@/lib/format";
import { OUTPUT_FORMAT_META } from "@/lib/presets";
import type { BatchDTO, JobDTO, JobStatus } from "@/lib/types";

const TERMINAL: JobStatus[] = ["COMPLETED", "FAILED", "CANCELED"];

function allTerminal(batch: BatchDTO) {
  return batch.jobs.length > 0 && batch.jobs.every((job) => TERMINAL.includes(job.status));
}

function statusLabel(status: BatchDTO["status"]) {
  const labels: Record<BatchDTO["status"], string> = {
    QUEUED: "Waiting for a worker",
    PROCESSING: "Processing",
    COMPLETED: "All conversions complete",
    FAILED: "Batch failed",
    CANCELED: "Batch canceled",
    MIXED: "Mixed states",
  };
  return labels[status];
}

export function ProgressClient({ batchId }: { batchId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const shouldStop = useCallback((data: { batch: BatchDTO }) => allTerminal(data.batch), []);
  const { data, error, loading, updatedAt, refresh } = usePolling<{ batch: BatchDTO }>(
    `/api/batches/${encodeURIComponent(batchId)}`,
    { intervalMs: 1200, shouldStop },
  );

  const batch = data?.batch;
  const live = Boolean(batch && !allTerminal(batch));
  const completedCount = batch?.counts.COMPLETED || 0;
  const failedCount = (batch?.counts.FAILED || 0) + (batch?.counts.CANCELED || 0);

  const copyBatchId = async () => {
    try {
      await navigator.clipboard.writeText(batchId);
      toast("Batch ID copied", "Use it when reviewing processing events or support logs.", "success");
    } catch {
      toast("Copy unavailable", "Your browser blocked clipboard access.", "error");
    }
  };

  const cancel = async (job: JobDTO) => {
    setBusyJob(job.id);
    try {
      await apiFetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      toast("Cancellation requested", "The worker will terminate FFmpeg when it observes the canceled state.", "info");
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
      toast("Retry queued", "A new persistent job was created; the original failure remains in history.", "success");
      router.push(`/progress/${response.batchId}`);
    } catch (caught) {
      toast("Could not retry", caught instanceof Error ? caught.message : undefined, "error");
      refresh();
    } finally {
      setBusyJob(null);
    }
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 border-b border-line/80 pb-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Conversion progress</p>
            <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">Follow the real work</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              Percentages come from FFmpeg&apos;s output time and are stored with each processing event. Queued jobs stay queued until a worker claims them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyBatchId}><Clipboard className="h-4 w-4" /> Copy batch ID</Button>
            <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" /> Refresh now</Button>
          </div>
        </div>

        {error && (
          <Card className="mt-6 flex flex-col gap-4 border-danger/20 bg-danger/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-danger">
              <TriangleAlert className="mt-0.5 h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </Card>
        )}

        {loading && !batch ? (
          <div className="mt-8 space-y-6">
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </div>
        ) : batch ? (
          <>
            <Card className="mt-8 overflow-hidden">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {batch.status !== "MIXED" ? <StatusPill status={batch.status} /> : <Badge tone="warning">Mixed states</Badge>}
                    <Badge tone={live ? "teal" : "neutral"}>
                      {live ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      {live ? "Live polling" : "Final state"}
                    </Badge>
                    <button onClick={copyBatchId} className="font-mono text-[11px] text-muted hover:text-brand" title="Copy full batch ID">
                      {batchId.slice(0, 8)}…
                    </button>
                  </div>
                  <h2 className="display-type mt-5 text-3xl font-medium tracking-tight text-ink">{statusLabel(batch.status)}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {batch.jobs.length} {batch.jobs.length === 1 ? "job" : "jobs"} · {completedCount} completed · {failedCount} failed or canceled
                  </p>

                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                      <span>Aggregate persisted progress</span>
                      <span>{percent(batch.aggregateProgress)}</span>
                    </div>
                    <ProgressBar value={batch.aggregateProgress} tone={batch.status === "FAILED" ? "danger" : batch.status === "COMPLETED" ? "success" : "brand"} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 self-center">
                  {(["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELED"] as const).map((status) => (
                    <div key={status} className={cn("rounded-2xl border border-line bg-surface-2/45 p-4", status === "CANCELED" && "col-span-2")}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{status}</p>
                      <p className="mt-1 font-display text-2xl font-medium text-ink">{batch.counts[status]}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-line bg-surface-2/35 px-6 py-3 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-teal" /> Last status read {updatedAt ? formatDate(updatedAt, { year: undefined }) : "pending"}</span>
                <span>No simulated completion or synthetic progress is used.</span>
              </div>
            </Card>

            <div className="mt-8 grid gap-6">
              {batch.jobs.map((job) => {
                const indeterminate = job.status === "QUEUED" || (job.status === "PROCESSING" && job.progress === 0);
                const canCancel = ["QUEUED", "PROCESSING"].includes(job.status);
                const canRetry = ["FAILED", "CANCELED"].includes(job.status);
                const meta = OUTPUT_FORMAT_META[job.targetFormat];
                return (
                  <Card key={job.id} className="overflow-hidden">
                    <div className="p-5 sm:p-7">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill status={job.status} />
                            <Badge tone="neutral">{meta.label}</Badge>
                            <Badge tone="brand">{job.presetLabel}</Badge>
                          </div>
                          <h3 className="mt-3 truncate text-lg font-bold text-ink" title={job.media?.displayName}>{job.media?.displayName || "Source media"}</h3>
                          <p className="mt-1 font-mono text-[10px] text-muted">JOB {job.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canCancel && (
                            <Button variant="outline" size="sm" disabled={busyJob === job.id} onClick={() => cancel(job)}>
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

                      <div className="mt-6">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                          <span>{job.stage || "Queued"}</span>
                          <span>{indeterminate ? "Awaiting measured output" : percent(job.progress)}</span>
                        </div>
                        <ProgressBar
                          value={job.progress}
                          indeterminate={indeterminate}
                          tone={job.status === "FAILED" ? "danger" : job.status === "COMPLETED" ? "success" : "teal"}
                        />
                      </div>

                      {job.errorMessage && (
                        <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.07] px-4 py-3 text-xs text-danger">
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <span><strong className="font-bold">{job.errorCode || "ERROR"}:</strong> {job.errorMessage}</span>
                        </div>
                      )}

                      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                        <div>
                          <p className="eyebrow">Processing events</p>
                          <ol className="mt-3 space-y-3">
                            {job.events.slice(-5).map((event) => (
                              <li key={event.id} className="relative flex gap-3 pl-5">
                                <span className={cn(
                                  "absolute left-0 top-1.5 h-2 w-2 rounded-full",
                                  event.level === "ERROR" ? "bg-danger" : event.level === "WARN" ? "bg-gold" : "bg-teal",
                                )} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-ink">{event.stage}{event.progress !== null ? ` · ${Math.round(event.progress)}%` : ""}</p>
                                  <p className="mt-0.5 text-[11px] leading-5 text-muted">{event.message}</p>
                                  <p className="mt-0.5 font-mono text-[10px] text-muted/70">{formatDate(event.createdAt, { year: undefined })}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div>
                          <p className="eyebrow">Outputs</p>
                          {job.outputs.length ? (
                            <div className="mt-3 space-y-3">
                              {job.outputs.map((output) => (
                                <div key={output.id} className="rounded-2xl border border-line bg-surface-2/45 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-bold text-ink" title={output.fileName}>{output.fileName}</p>
                                      <p className="mt-1 text-[11px] text-muted">{formatBytes(output.sizeBytes)} · expires {formatDate(output.expiresAt, { year: undefined })}</p>
                                    </div>
                                    <a href={`/api/outputs/${output.id}/download`} className="shrink-0" title="Request a new short-lived signed download link">
                                      <Button size="sm" variant="secondary"><Download className="h-3.5 w-3.5" /> Download</Button>
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-dashed border-line px-4 py-5 text-xs text-muted">
                              <FileClock className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{job.status === "COMPLETED" ? "The output has expired or been cleaned up." : "An output record appears only after FFmpeg succeeds, the signature is verified and the object is stored."}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-semibold text-ink">Downloads are ownership-checked</p>
                  <p className="text-xs text-muted">Each link is generated only when requested and expires independently of the file retention window.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/history"><Button variant="outline" size="sm"><Info className="h-4 w-4" /> History</Button></Link>
                <Link href="/workspace"><Button size="sm">New conversion <ArrowRight className="h-4 w-4" /></Button></Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
