"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Database,
  HardDrive,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const HEADER = "x-clearframe-admin-key";
const STORAGE_KEY = "clearframe.adminKey";

interface AdminOverview {
  generatedAt: string;
  queueMode: string;
  storageDriver: string;
  config: { retentionHours: number; maxUploadBytes: number; maxBatchFiles: number };
  checks: Record<string, string>;
  counts: { users: number; media: number; jobs: number; outputs: number; activeJobs: number; failedJobs: number };
  queue: Record<string, number> | null;
  worker: { workerId: string; mode: string; timestamp: string; pid: number } | null;
  recentFailures: Array<{ id: string; targetFormat: string; errorCode: string | null; errorMessage: string | null; createdAt: string }>;
}

function tone(value?: string) {
  if (value === "ok") return "success" as const;
  if (value === "standalone" || value === "not-configured") return "neutral" as const;
  return "danger" as const;
}

export function AdminClient() {
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  const load = useCallback(async (candidate: string) => {
    if (!candidate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<AdminOverview>("/api/admin/overview", { headers: { [HEADER]: candidate } });
      setOverview(result);
      setAuthorized(true);
      window.sessionStorage.setItem(STORAGE_KEY, candidate);
    } catch (caught) {
      setAuthorized(false);
      setOverview(null);
      setError(caught instanceof Error ? caught.message : "Admin access failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setKey(stored);
      void load(stored);
    }
  }, [load]);

  const forget = () => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setKey("");
    setAuthorized(false);
    setOverview(null);
    setError(null);
  };

  const runCleanup = async () => {
    setCleaning(true);
    try {
      const result = await apiFetch<{ deletedOutputs: number; expiredMedia: number; deletedObjects: number }>("/api/admin/overview", {
        method: "POST",
        headers: { [HEADER]: key },
      });
      toast(
        "Cleanup complete",
        `${result.deletedObjects} objects removed · ${result.expiredMedia} media records expired · ${result.deletedOutputs} outputs deleted.`,
        "success",
      );
      await load(key);
    } catch (caught) {
      toast("Cleanup failed", caught instanceof Error ? caught.message : undefined, "error");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="container-shell">
        <div className="border-b border-line/80 pb-8">
          <p className="eyebrow">Operations</p>
          <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">Admin overview</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            This page is protected by the deployment&apos;s <code className="font-mono text-xs">ADMIN_TOKEN</code>. It does not use a user account and never displays the configured secret.
          </p>
        </div>

        {!authorized ? (
          <Card className="mx-auto mt-10 max-w-xl p-7 sm:p-9">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><LockKeyhole className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-2xl font-medium tracking-tight text-ink">Enter the admin access key</h2>
                <p className="mt-2 text-xs leading-6 text-muted">The key is held in session storage only for this tab and is sent in a request header for each admin API call.</p>
              </div>
            </div>
            <form
              className="mt-7 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void load(key);
              }}
            >
              <div>
                <label htmlFor="admin-key" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Admin key</label>
                <input
                  id="admin-key"
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="Paste ADMIN_TOKEN"
                  className="h-12 w-full rounded-xl border border-line bg-surface px-4 font-mono text-sm text-ink placeholder:font-sans placeholder:text-muted/70 focus:border-brand focus:outline-none"
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs text-danger" role="alert">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                <KeyRound className="h-4 w-4" /> Unlock overview
              </Button>
            </form>
            <p className="mt-5 text-center text-[11px] leading-5 text-muted">
              No key configured? Set a strong random <code className="font-mono">ADMIN_TOKEN</code> in the environment and restart the web service.
            </p>
          </Card>
        ) : overview ? (
          <>
            <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-line bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-semibold text-ink">Read from live services</p>
                  <p className="text-xs text-muted">Generated {formatDate(overview.generatedAt)} · queue {overview.queueMode} · storage {overview.storageDriver}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => load(key)} loading={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
                <Button variant="soft" size="sm" onClick={runCleanup} loading={cleaning}><Trash2 className="h-4 w-4" /> Run cleanup</Button>
                <Button variant="ghost" size="sm" onClick={forget}>Forget key</Button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Guest sessions", value: overview.counts.users, icon: LockKeyhole },
                { label: "Media files", value: overview.counts.media, icon: HardDrive },
                { label: "Conversion jobs", value: overview.counts.jobs, icon: Activity },
                { label: "Stored outputs", value: overview.counts.outputs, icon: Database },
                { label: "Active jobs", value: overview.counts.activeJobs, icon: Activity },
                { label: "Failed jobs", value: overview.counts.failedJobs, icon: TriangleAlert },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{item.label}</p>
                        <p className="mt-3 font-display text-3xl font-medium text-ink">{item.value}</p>
                      </div>
                      <Icon className="h-4 w-4 text-muted" />
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card className="p-6 sm:p-8">
                <p className="eyebrow">Service checks</p>
                <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Dependencies</h2>
                <div className="mt-6 space-y-3">
                  {Object.entries(overview.checks).map(([name, status]) => (
                    <div key={name} className="flex items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                      <span className="text-sm font-semibold capitalize text-ink">{name}</span>
                      <Badge tone={tone(status)}>{status}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-line pt-5">
                  <p className="eyebrow">Deployment limits</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted">Max upload</dt><dd className="mt-1 font-semibold text-ink">{Math.round(overview.config.maxUploadBytes / 1024 / 1024)} MB</dd></div>
                    <div><dt className="text-muted">Batch size</dt><dd className="mt-1 font-semibold text-ink">{overview.config.maxBatchFiles} files</dd></div>
                    <div><dt className="text-muted">Retention</dt><dd className="mt-1 font-semibold text-ink">{overview.config.retentionHours} hours</dd></div>
                    <div><dt className="text-muted">Queue</dt><dd className="mt-1 font-semibold text-ink">{overview.queueMode}</dd></div>
                  </dl>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-6 sm:p-8">
                  <p className="eyebrow">Worker & queue</p>
                  <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Processing state</h2>
                  {overview.worker ? (
                    <div className="mt-5 rounded-2xl border border-success/20 bg-success/[0.06] p-4">
                      <div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" /></span><p className="text-xs font-bold text-ink">Worker heartbeat received</p></div>
                      <p className="mt-2 font-mono text-[11px] text-muted">{overview.worker.workerId}</p>
                      <p className="mt-1 text-[11px] text-muted">{overview.worker.mode} · PID {overview.worker.pid} · {formatDate(overview.worker.timestamp)}</p>
                    </div>
                  ) : (
                    <div className="mt-5 flex items-start gap-2 rounded-2xl border border-gold/25 bg-gold/10 p-4 text-xs text-muted">
                      <TriangleAlert className="mt-0.5 h-4 w-4 text-gold" /> No recent worker heartbeat. Start the separate worker service before submitting conversions.
                    </div>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {(overview.queue ? Object.entries(overview.queue) : [["database-poller", overview.counts.activeJobs]]).map(([name, value]) => (
                      <div key={name} className="rounded-xl border border-line bg-surface-2/40 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{name}</p>
                        <p className="mt-1 font-display text-xl text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6 sm:p-8">
                  <p className="eyebrow">Recent failures</p>
                  <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Job errors</h2>
                  {overview.recentFailures.length ? (
                    <div className="mt-5 divide-y divide-line/80">
                      {overview.recentFailures.map((failure) => (
                        <div key={failure.id} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-[11px] text-muted">{failure.id.slice(0, 8)}… · {failure.targetFormat}</p>
                            <Badge tone="danger">{failure.errorCode || "ERROR"}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{failure.errorMessage || "No message"}</p>
                          <p className="mt-1 text-[10px] text-muted">{formatDate(failure.createdAt, { year: undefined })}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 rounded-xl border border-line bg-surface-2/40 px-4 py-5 text-xs text-muted">No failed jobs have been recorded.</p>
                  )}
                  <a href="/api/health" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:gap-2">
                    Open raw health endpoint <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
