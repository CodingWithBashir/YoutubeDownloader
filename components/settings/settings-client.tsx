"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clipboard,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { useClientSettings } from "@/components/hooks/use-client-settings";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { DEFAULT_CLIENT_SETTINGS } from "@/lib/client-settings";
import {
  AUDIO_BITRATE_VALUES,
  OUTPUT_FORMAT_META,
  OUTPUT_FORMAT_VALUES,
  VIDEO_PRESETS,
  VIDEO_QUALITIES,
  type AudioBitrate,
  type OutputFormat,
  type VideoPresetId,
  type VideoQuality,
} from "@/lib/presets";
import type { PublicConfig } from "@/lib/types";

const themeOptions: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { settings, update, ready } = useClientSettings();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [session, setSession] = useState<{ guestId: string; retentionHours: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<PublicConfig>("/api/config").catch(() => null),
      apiFetch<{ guestId: string; retentionHours: number }>("/api/session").catch(() => null),
    ]).then(([configResult, sessionResult]) => {
      if (!active) return;
      setConfig(configResult);
      setSession(sessionResult);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready && settings.theme !== theme) update({ theme });
  }, [ready, settings.theme, theme, update]);

  const chooseTheme = (value: ThemePreference) => {
    setTheme(value);
    update({ theme: value });
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "clearframe-device-settings.json";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    toast("Settings exported", "Device preferences were saved as JSON.", "success");
  };

  const copySessionId = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.guestId);
      toast("Session ID copied", "This opaque ID is not an account and cannot sign you in on another device.", "success");
    } catch {
      toast("Copy unavailable", "Your browser blocked clipboard access.", "error");
    }
  };

  const clearGuestData = async () => {
    setClearing(true);
    try {
      await apiFetch("/api/session", { method: "DELETE" });
      toast("Guest data cleared", "Associated objects were removed and the session cookie was cleared.", "success");
      router.replace("/");
    } catch (caught) {
      toast("Could not clear data", caught instanceof Error ? caught.message : undefined, "error");
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 border-b border-line/80 pb-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Settings</p>
            <h1 className="display-type mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">Your device, your defaults</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              There is no account. Appearance and conversion defaults are stored locally in this browser; server-side retention and security policies are deployment-wide.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportSettings}><Download className="h-4 w-4" /> Export preferences</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                update(DEFAULT_CLIENT_SETTINGS);
                setTheme(DEFAULT_CLIENT_SETTINGS.theme);
                toast("Defaults restored", "Device preferences were reset.", "success");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Restore defaults
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-6">
            <Card className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Appearance</p>
                  <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Theme & motion</h2>
                </div>
                <Badge tone="neutral">Saved locally</Badge>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = theme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseTheme(option.id)}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border p-4 text-sm font-semibold transition",
                        active ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:text-ink",
                      )}
                      aria-pressed={active}
                    >
                      <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" /> {option.label}</span>
                      {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 space-y-3">
                <Toggle
                  checked={settings.reducedMotion}
                  onChange={(value) => update({ reducedMotion: value })}
                  label="Reduce interface motion"
                  description="Disables decorative animations and smooth scrolling in this browser."
                />
                <Toggle
                  checked={settings.autoOpenProgress}
                  onChange={(value) => update({ autoOpenProgress: value })}
                  label="Open progress after queuing"
                  description="When off, the workspace shows a link to the new batch instead of navigating away."
                />
              </div>
            </Card>

            <Card className="p-6 sm:p-8">
              <p className="eyebrow">Conversion defaults</p>
              <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Start from your preferred preset</h2>
              <p className="mt-3 text-xs leading-6 text-muted">
                Defaults are applied only when compatible with the source. The workspace always verifies stream compatibility and caps resolution to the original.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Select<OutputFormat>
                  id="default-format"
                  label="Default output"
                  value={settings.defaultFormat}
                  options={OUTPUT_FORMAT_VALUES.map((format) => ({ value: format, label: `${OUTPUT_FORMAT_META[format].label} · ${OUTPUT_FORMAT_META[format].description}` }))}
                  onChange={(value) => update({ defaultFormat: value })}
                />
                <Select<VideoPresetId>
                  id="default-resolution"
                  label="Default resolution"
                  value={settings.defaultVideoPreset}
                  options={VIDEO_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                  onChange={(value) => update({ defaultVideoPreset: value })}
                />
                <Select<VideoQuality>
                  id="default-video-quality"
                  label="Video quality"
                  value={settings.defaultVideoQuality}
                  options={VIDEO_QUALITIES.map((quality) => ({ value: quality.id, label: `${quality.label} · ${quality.note}` }))}
                  onChange={(value) => update({ defaultVideoQuality: value })}
                />
                <Select<AudioBitrate>
                  id="default-audio-bitrate"
                  label="Audio bitrate"
                  value={settings.defaultAudioBitrate}
                  options={AUDIO_BITRATE_VALUES.map((bitrate) => ({ value: bitrate as AudioBitrate, label: `${bitrate} kbps` }))}
                  onChange={(value) => update({ defaultAudioBitrate: value })}
                  hint="Ignored for lossless WAV and FLAC outputs."
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <p className="eyebrow">Guest session</p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">No account required</h2>
                </div>
              </div>
              <dl className="mt-6 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
                  <dt className="text-muted">Opaque session ID</dt>
                  <dd className="font-mono font-semibold text-ink">{session ? `${session.guestId.slice(0, 10)}…` : "created on intake"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
                  <dt className="text-muted">Retention window</dt>
                  <dd className="font-semibold text-ink">{config?.retentionHours || session?.retentionHours || 24} hours</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
                  <dt className="text-muted">Authentication</dt>
                  <dd className="font-semibold text-ink">Signed anonymous cookie</dd>
                </div>
              </dl>
              {session && (
                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={copySessionId}>
                  <Clipboard className="h-4 w-4" /> Copy session ID
                </Button>
              )}

              <div className="mt-6 rounded-2xl border border-danger/20 bg-danger/[0.05] p-4">
                <div className="flex items-start gap-2 text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p className="text-xs font-bold">Clear this guest session</p>
                </div>
                <p className="mt-2 text-xs leading-6 text-muted">
                  Removes associated source files, outputs, previews and job records from this deployment, then clears the cookie. This cannot be undone.
                </p>
                {!confirmClear ? (
                  <Button variant="outline" size="sm" className="mt-4 w-full text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmClear(true)}>
                    <Trash2 className="h-4 w-4" /> Clear guest data
                  </Button>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <Button variant="danger" size="sm" className="flex-1" loading={clearing} onClick={clearGuestData}>Yes, delete</Button>
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => setConfirmClear(false)}>Keep data</Button>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 sm:p-8">
              <p className="eyebrow">Deployment integrations</p>
              <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">Credentials are explicit</h2>
              <div className="mt-5 space-y-3">
                {[
                  { icon: KeyRound, title: "SESSION_SECRET & ADMIN_TOKEN", text: "Required server secrets for signed cookies, local links and admin access. Never sent to the browser." },
                  { icon: Database, title: "PostgreSQL & Redis", text: "Connection strings are supplied through the environment or Docker Compose. No embedded defaults in production." },
                  { icon: HardDrive, title: "S3-compatible storage", text: "MinIO or S3 requires an endpoint, bucket, region and access keys. Local filesystem storage is for development only." },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-3.5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                      <div>
                        <p className="text-xs font-bold text-ink">{item.title}</p>
                        <p className="mt-1 text-[11px] leading-5 text-muted">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/legal/privacy"><Button variant="outline" size="sm">Privacy</Button></Link>
                <Link href="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
                <a href="/api/health" target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Service health</Button></a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
