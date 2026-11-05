import type { AudioBitrate, OutputFormat, VideoPresetId, VideoQuality } from "@/lib/presets";

export interface ClientSettings {
  theme: "light" | "dark" | "system";
  defaultFormat: OutputFormat;
  defaultVideoPreset: VideoPresetId;
  defaultVideoQuality: VideoQuality;
  defaultAudioBitrate: AudioBitrate;
  reducedMotion: boolean;
  autoOpenProgress: boolean;
}

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  theme: "system",
  defaultFormat: "MP4",
  defaultVideoPreset: "source",
  defaultVideoQuality: "balanced",
  defaultAudioBitrate: 192,
  reducedMotion: false,
  autoOpenProgress: true,
};

const STORAGE_KEY = "clearframe.settings.v1";

export function loadClientSettings(): ClientSettings {
  if (typeof window === "undefined") return DEFAULT_CLIENT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ClientSettings>;
    return { ...DEFAULT_CLIENT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

export function saveClientSettings(settings: ClientSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
}
