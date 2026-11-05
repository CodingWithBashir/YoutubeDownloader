"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleCheck,
  Clock3,
  Database,
  HardDrive,
  Layers3,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar, Skeleton, StatusPill } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/components/hooks/use-polling";
import { apiFetch } from "@/lib/api-client";
import { formatBytes, formatDate, percent } from "@/lib/format";
import type { JobDTO } from "@/lib/types";

interface StatsResponse {
  counts: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    mediaCount: number;
    expiringSoon: number;
  };
  storedBytes: number;
  recentJobs: JobDTO[];
  retentionHours: number;
}

interface HealthResponse {
  status: "ok" | "degraded";
  checks: Record<string, string>;
  queueMode: string;
  storageDriver: string;
}

function healthTone(value?: string) {
  if (value === "ok") return "success" as const;
  if (value === "standalone" || value === "not-configured") return "neutral" as const;
  return "danger" as const;
}

export function DashboardClient() {
  const { data, error, loading, updatedAt } = usePolling<StatsResponse>("/api/stats", { intervalMs: 5000 });
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [session, setSession] = useState<{ guestId: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<HealthResponse>("/api/health").catch(() => null),
      apiFetch<{ guestId: string }>("/api/session").catch(() => null),
    ]).then(([healthResult, sessionResult]) => {
      if (!active) return;
      setHealth(healthResult);
      setSession(sessionResult);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="py-12 sm:py-16">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 border-b border-line/80 pb-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Guest dashboard</p>
            <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">A clear view of your work</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              These values are read from your signed guest session&apos;s database records. No account, no sample data and no invented activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/history"><Button variant="outline" size="sm">View history</Button></Link>
            <Link href="/#start"><Button size="sm">New conversion <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</div>
        )}

        {loading && !data ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-3xl" />)}
          </div>
        ) : data ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total jobs", value: data.counts.totalJobs, icon: Layers3, note: `${data.counts.activeJobs} currently active` },
                { label: "Completed", value: data.counts.completedJobs, icon: CircleCheck, note: `${data.counts.failedJobs} failed` },
                { label: "Ready media", value: data.counts.mediaCount, icon: Boxes, note: `${data.counts.expiringSoon} expiring within 6h` },
                { label: "Stored bytes", value: formatBytes(data.storedBytes), icon: HardDrive, note: `${data.retentionHours}h retention policy` },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{item.label}</p>
                        <p className="mt-3 font-display text-3xl font-medium tracking-tight text-ink">{item.value}</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-teal"><Icon className="h-4 w-4" /></div>
                    </div>
                    <p className="mt-4 text-xs text-muted">{item.note}</p>
                  </Card>
                );
              })}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <Card className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Recent activity</p>
                    <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Latest conversion jobs</h2>
                  </div>
                  <Badge tone="teal"><Activity className="h-3 w-3" /> Live records</Badge>
                </div>

                {data.recentJobs.length ? (
                  <div className="mt-7 divide-y divide-line/80">
                    {data.recentJobs.map((job) => (
                      <div key={job.id} className="grid gap-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill status={job.status} />
                            <Badge tone="neutral">{job.targetFormat}</Badge>
                          </div>
                          <p className="mt-2 truncate text-sm font-semibold text-ink" title={job.media?.displayName}>{job.media?.displayName || "Source media"}</p>
                          <p className="mt-1 text-xs text-muted">{job.presetLabel} · {formatDate(job.createdAt, { year: undefined })}</p>
                          {job.status === "PROCESSING" && (
                            <div className="mt-3 max-w-sm"><ProgressBar value={job.progress} tone="teal" /><p className="mt-1 text-[11px] text-muted">{job.stage} · {percent(job.progress)}</p></div>
                          )}
                        </div>
                        <Link href={`/progress/${job.batchId}`}><Button variant="outline" size="sm">Details <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-7">
                    <EmptyState
                      title="No conversions yet"
                      description="Your first real FFmpeg job will appear here with its persisted status and processing events."
                      action={<Link href="/#start"><Button>Start a conversion</Button></Link>}
                    />
                  </div>
                )}
              </Card>

              <div className="space-y-6">
                <Card className="p-6 sm:p-8">
                  <p className="eyebrow">Service state</p>
                  <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Infrastructure</h2>
                  <div className="mt-6 space-y-3">
                    {[
                      { label: "PostgreSQL", value: health?.checks.database, icon: Database },
                      { label: "Redis / queue", value: health?.checks.redis, icon: Activity },
                      { label: "Object storage", value: health?.checks.storage, icon: HardDrive },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink"><Icon className="h-4 w-4 text-muted" />{item.label}</span>
                          <Badge tone={healthTone(item.value)}>{item.value || "checking"}</Badge>
                        </div>
                      );
                    })}
                  </div>
                  <dl className="mt-5 space-y-2 border-t border-line pt-5 text-xs">
                    <div className="flex justify-between"><dt className="text-muted">Queue mode</dt><dd className="font-mono font-semibold text-ink">{health?.queueMode || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Storage driver</dt><dd className="font-mono font-semibold text-ink">{health?.storageDriver || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Last read</dt><dd className="font-semibold text-ink">{updatedAt ? formatDate(updatedAt, { year: undefined }) : "—"}</dd></div>
                  </dl>
                </Card>

                <Card className="border-success/20 bg-success/[0.05] p-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-success" />
                    <div>
                      <h3 className="text-sm font-bold text-ink">Private guest session</h3>
                      <p className="mt-2 text-xs leading-6 text-muted">
                        {session ? `Session ${session.guestId.slice(0, 8)}… scopes every record on this page. Clear it from Settings to remove associated objects.` : "A signed anonymous session is created when you add media."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="success"><Sparkles className="h-3 w-3" /> No account</Badge>
                        <Badge tone="neutral"><Clock3 className="h-3 w-3" /> {data.retentionHours}h retention</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : null}

        {health?.status === "degraded" && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm text-muted">
            <TriangleAlert className="mt-0.5 h-5 w-5 text-gold" />
            <span>One or more backing services reported an error. Conversions will fail visibly rather than being marked complete. Check Docker Compose services and environment variables.</span>
          </div>
        )}
      </div>
    </div>
  );
}
