"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  AudioLines,
  CircleAlert,
  CopyCheck,
  FileVideo2,
  Info,
  Plus,
  ShieldCheck,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useClientSettings } from "@/components/hooks/use-client-settings";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import {
  AUDIO_BITRATE_VALUES,
  OUTPUT_FORMAT_META,
  VIDEO_PRESETS,
  VIDEO_QUALITIES,
  allowedFormatsFor,
  estimateOutputBytes,
  isLosslessAudio,
  normalizeConversionSettings,
  videoBitrateFor,
  type AudioBitrate,
  type MediaCapabilities,
  type OutputFormat,
  type VideoPresetId,
  type VideoQuality,
} from "@/lib/presets";
import type { ClientSettings } from "@/lib/client-settings";
import type { CreateJobInput, MediaDTO, PublicConfig } from "@/lib/types";

interface Selection {
  targetFormat: OutputFormat;
  videoPreset: VideoPresetId;
  videoQuality: VideoQuality;
  audioBitrateKbps: AudioBitrate;
}

function capabilities(media: MediaDTO): MediaCapabilities {
  return {
    kind: media.kind,
    width: media.width,
    height: media.height,
    hasVideo: media.hasVideo,
    hasAudio: media.hasAudio,
    durationSeconds: media.durationSeconds,
  };
}

function defaultSelection(media: MediaDTO, settings: ClientSettings): Selection {
  const allowed = allowedFormatsFor(capabilities(media));
  const targetFormat = allowed.includes(settings.defaultFormat) ? settings.defaultFormat : allowed[0];
  return {
    targetFormat,
    videoPreset: settings.defaultVideoPreset,
    videoQuality: settings.defaultVideoQuality,
    audioBitrateKbps: settings.defaultAudioBitrate,
  };
}

export function WorkspaceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { settings, ready } = useClientSettings();
  const idsKey = searchParams.get("media") || "";
  const ids = useMemo(() => idsKey.split(",").map((item) => item.trim()).filter(Boolean), [idsKey]);

  const [media, setMedia] = useState<MediaDTO[]>([]);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<PublicConfig>("/api/config")
      .then((value) => active && setConfig(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!ids.length) {
      setLoading(false);
      setMedia([]);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<{ media: MediaDTO[]; missingIds: string[] }>(`/api/media?ids=${encodeURIComponent(ids.join(","))}`)
      .then((response) => {
        if (!active) return;
        setMedia(response.media);
        setMissingIds(response.missingIds || []);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "The workspace could not load."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [idsKey, ids]);

  useEffect(() => {
    if (!ready || !media.length) return;
    setSelections((current) => {
      const next = { ...current };
      for (const item of media) if (!next[item.id]) next[item.id] = defaultSelection(item, settings);
      return next;
    });
    setIncluded((current) => {
      const next = new Set(current);
      for (const item of media) next.add(item.id);
      return next;
    });
  }, [ready, media, settings]);

  const getSelection = useCallback(
    (item: MediaDTO) => selections[item.id] || defaultSelection(item, settings),
    [selections, settings],
  );

  const updateSelection = useCallback((id: string, patch: Partial<Selection>) => {
    setSelections((current) => ({
      ...current,
      [id]: { ...(current[id] || { targetFormat: "MP4", videoPreset: "source", videoQuality: "balanced", audioBitrateKbps: 192 }), ...patch },
    }));
  }, []);

  const summaryFor = useCallback(
    (item: MediaDTO) => {
      const selection = getSelection(item);
      try {
        const normalized = normalizeConversionSettings(capabilities(item), selection);
        return {
          normalized,
          estimatedBytes: estimateOutputBytes(normalized, item.durationSeconds),
          error: null as string | null,
        };
      } catch (caught) {
        return { normalized: null, estimatedBytes: null, error: caught instanceof Error ? caught.message : "Invalid output settings." };
      }
    },
    [getSelection],
  );

  const includedMedia = media.filter((item) => included.has(item.id));
  const canSubmit = includedMedia.length > 0 && authorized && !submitting && !loading;

  const applyToAll = () => {
    const source = includedMedia[0] || media[0];
    if (!source) return;
    const selection = getSelection(source);
    setSelections(Object.fromEntries(media.map((item) => [item.id, { ...selection }])));
    toast("Settings applied", `All ${media.length} files now use ${OUTPUT_FORMAT_META[selection.targetFormat].label} and ${selection.videoQuality} quality.`, "success");
  };

  const removeMedia = async (item: MediaDTO) => {
    try {
      await apiFetch(`/api/media/${item.id}`, { method: "DELETE" });
      setMedia((current) => current.filter((candidate) => candidate.id !== item.id));
      setIncluded((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      toast("File removed", `${item.displayName} was marked for cleanup.`, "success");
    } catch (caught) {
      toast("Could not remove file", caught instanceof Error ? caught.message : undefined, "error");
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const items: CreateJobInput[] = includedMedia.map((item) => {
        const selection = getSelection(item);
        return {
          mediaId: item.id,
          targetFormat: selection.targetFormat,
          videoPreset: selection.videoPreset,
          videoQuality: selection.videoQuality,
          audioBitrateKbps: selection.audioBitrateKbps,
        };
      });
      const response = await apiFetch<{ batchId: string }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ items, authorized: true }),
      });
      setLastBatchId(response.batchId);
      toast("Batch queued", `${items.length} real conversion ${items.length === 1 ? "job was" : "jobs were"} persisted and queued.`, "success");
      if (settings.autoOpenProgress) router.push(`/progress/${response.batchId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The batch could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 border-b border-line/80 pb-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Conversion workspace</p>
            <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">Inspect, configure, convert</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              Metadata below comes from FFprobe. Choose an output for each file, confirm your rights, and submit a batch to the background worker.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/#start"><Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Add more files</Button></Link>
            {media.length > 1 && <Button variant="ghost" size="sm" onClick={applyToAll}><WandSparkles className="h-4 w-4 text-teal" /> Apply first settings to all</Button>}
          </div>
        </div>

        {missingIds.length > 0 && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm text-muted">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>{missingIds.length} selected {missingIds.length === 1 ? "file is" : "files are"} no longer available, possibly because they expired. Add the media again to include it.</span>
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger" role="alert">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {lastBatchId && !settings.autoOpenProgress && (
          <Card className="mt-6 flex flex-col gap-4 border-success/25 bg-success/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CopyCheck className="mt-0.5 h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-semibold text-ink">Batch {lastBatchId.slice(0, 8)} is queued</p>
                <p className="text-xs text-muted">Track the actual worker progress or review it later in history.</p>
              </div>
            </div>
            <Link href={`/progress/${lastBatchId}`}><Button size="sm">View progress <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </Card>
        )}

        {loading ? (
          <div className="mt-8 grid gap-6">
            {[1, 2].map((item) => <Skeleton key={item} className="h-80 rounded-3xl" />)}
          </div>
        ) : media.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="No media in this workspace"
              description="Upload your own files or import an authorized direct media-file URL. Guest sessions keep the workspace private without an account."
              action={<Link href="/#start"><Button>Add media</Button></Link>}
            />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {media.map((item) => {
              const selection = getSelection(item);
              const summary = summaryFor(item);
              const allowed = allowedFormatsFor(capabilities(item));
              const isVideoTarget = OUTPUT_FORMAT_META[selection.targetFormat].family === "video";
              const showAudioBitrate = isVideoTarget ? item.hasAudio : !isLosslessAudio(selection.targetFormat);
              const videoOptions = VIDEO_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));
              const qualityOptions = VIDEO_QUALITIES.map((quality) => ({ value: quality.id, label: `${quality.label} · ${quality.note}` }));
              const audioOptions = AUDIO_BITRATE_VALUES.map((bitrate) => ({ value: bitrate as AudioBitrate, label: `${bitrate} kbps` }));

              return (
                <Card key={item.id} className={cn("overflow-hidden transition", !included.has(item.id) && "opacity-60")}>
                  <div className="grid lg:grid-cols-[290px_1fr]">
                    <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden border-b border-line bg-surface-2 lg:border-b-0 lg:border-r">
                      {item.hasThumbnail ? (
                        <img
                          src={`/api/media/${item.id}/asset?kind=thumbnail`}
                          alt={`Preview of ${item.displayName}`}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-center text-muted">
                          {item.kind === "VIDEO" ? <FileVideo2 className="mx-auto h-10 w-10" /> : <AudioLines className="mx-auto h-10 w-10" />}
                          <p className="mt-2 text-xs">No preview generated</p>
                        </div>
                      )}
                      <div className="absolute left-4 top-4 flex gap-2">
                        <Badge tone={item.kind === "VIDEO" ? "brand" : "teal"}>{item.kind === "VIDEO" ? "Video" : "Audio"}</Badge>
                        <Badge tone="neutral">.{item.container}</Badge>
                      </div>
                      {item.hasPreview && (
                        <a
                          href={`/api/media/${item.id}/asset?kind=preview`}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-4 left-4 inline-flex h-9 items-center gap-2 rounded-xl bg-ink/85 px-3 text-xs font-semibold text-canvas backdrop-blur transition hover:bg-ink"
                        >
                          Play preview <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="p-5 sm:p-7">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={included.has(item.id)}
                              onChange={(event) => setIncluded((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(item.id);
                                else next.delete(item.id);
                                return next;
                              })}
                              className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]"
                            />
                            <span>
                              <span className="block truncate text-base font-bold text-ink" title={item.displayName}>{item.displayName}</span>
                              <span className="mt-1 block font-mono text-[10px] text-muted">SHA-256 {item.sha256.slice(0, 16)}…</span>
                            </span>
                          </label>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeMedia(item)} className="self-start text-danger hover:bg-danger/10 hover:text-danger">
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>

                      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface-2/45 p-4 sm:grid-cols-4">
                        {[
                          { label: "Duration", value: formatDuration(item.durationSeconds) },
                          { label: "Dimensions", value: item.width && item.height ? `${item.width}×${item.height}` : "—" },
                          { label: "Video codec", value: item.videoCodec?.toUpperCase() || "—" },
                          { label: "Audio codec", value: item.audioCodec?.toUpperCase() || "—" },
                          { label: "Frame rate", value: item.frameRate || "—" },
                          { label: "File size", value: formatBytes(item.sizeBytes) },
                          { label: "Streams", value: `${item.hasVideo ? "Video " : ""}${item.hasAudio ? "Audio" : ""}`.trim() || "—" },
                          { label: "Expires", value: formatDate(item.expiresAt, { year: undefined, hour: "2-digit", minute: "2-digit" }) },
                        ].map((detail) => (
                          <div key={detail.label} className="min-w-0">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{detail.label}</dt>
                            <dd className="mt-1 truncate text-xs font-semibold text-ink" title={String(detail.value)}>{detail.value}</dd>
                          </div>
                        ))}
                      </dl>

                      {item.sourceDomain && (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
                          <ShieldCheck className="h-3.5 w-3.5 text-success" /> Imported from verified direct-file host <strong className="font-semibold text-ink">{item.sourceDomain}</strong>
                        </p>
                      )}

                      <div className="mt-6">
                        <p className="eyebrow">Output format</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {allowed.map((format) => {
                            const meta = OUTPUT_FORMAT_META[format];
                            const active = selection.targetFormat === format;
                            return (
                              <button
                                key={format}
                                type="button"
                                onClick={() => updateSelection(item.id, { targetFormat: format })}
                                className={cn(
                                  "group rounded-xl border px-3.5 py-2.5 text-left transition",
                                  active ? "border-brand bg-brand-soft text-brand shadow-soft" : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink",
                                )}
                                aria-pressed={active}
                              >
                                <span className="block text-xs font-bold">{meta.label}</span>
                                <span className="mt-0.5 block text-[10px] opacity-75">{meta.family === "video" ? "Video" : "Audio"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {isVideoTarget && (
                          <>
                            <Select<VideoPresetId>
                              id={`resolution-${item.id}`}
                              label="Resolution"
                              value={selection.videoPreset}
                              options={videoOptions}
                              onChange={(value) => updateSelection(item.id, { videoPreset: value })}
                              hint="Higher values are capped to the source."
                            />
                            <Select<VideoQuality>
                              id={`quality-${item.id}`}
                              label="Video bitrate"
                              value={selection.videoQuality}
                              options={qualityOptions}
                              onChange={(value) => updateSelection(item.id, { videoQuality: value })}
                              hint={`≈ ${(videoBitrateFor(selection.videoPreset, selection.videoQuality, item.height) / 1000).toFixed(1)} Mbps`}
                            />
                          </>
                        )}
                        {showAudioBitrate && (
                          <Select<AudioBitrate>
                            id={`audio-${item.id}`}
                            label={isVideoTarget ? "Audio track bitrate" : "Audio bitrate"}
                            value={selection.audioBitrateKbps}
                            options={audioOptions}
                            onChange={(value) => updateSelection(item.id, { audioBitrateKbps: value })}
                            hint={isVideoTarget ? "Applied when the source has audio." : undefined}
                          />
                        )}
                        {!isVideoTarget && isLosslessAudio(selection.targetFormat) && (
                          <div className="flex items-center rounded-2xl border border-success/20 bg-success/[0.07] px-4 py-3 text-xs text-success">
                            <Info className="mr-2 h-4 w-4" /> Lossless output · no bitrate preset needed
                          </div>
                        )}
                      </div>

                      {summary.error ? (
                        <p className="mt-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs text-danger">{summary.error}</p>
                      ) : summary.normalized && (
                        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/40 px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
                          <span><strong className="font-semibold text-ink">{summary.normalized.presetLabel}</strong> · {OUTPUT_FORMAT_META[summary.normalized.targetFormat].description}</span>
                          <span className="font-mono">Estimated {formatBytes(summary.estimatedBytes || 0)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {media.length > 0 && (
          <Card className="mt-8 p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-success" />
                  <h2 className="font-display text-2xl font-medium tracking-tight text-ink">Confirm and queue batch</h2>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5">
                  <input
                    type="checkbox"
                    checked={authorized}
                    onChange={(event) => setAuthorized(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]"
                  />
                  <span className="text-xs leading-5 text-muted">
                    <strong className="font-semibold text-ink">I own these files or have explicit authorization to process them.</strong> I will not use this service for protected streaming pages, DRM circumvention or unlicensed content.
                  </span>
                </label>
                <p className="mt-3 text-[11px] text-muted">
                  {includedMedia.length} of {media.length} files selected · {config?.retentionHours || 24}h retention · each job is persisted before processing
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row lg:flex-col">
                <Button size="lg" onClick={submit} disabled={!canSubmit} loading={submitting}>
                  {submitting ? "Creating jobs" : `Convert ${includedMedia.length} ${includedMedia.length === 1 ? "file" : "files"}`}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>
                <Link href="/history" className="text-center text-xs font-semibold text-muted hover:text-brand">View conversion history</Link>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
 );
}
