"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CLIENT_SETTINGS, loadClientSettings, saveClientSettings, type ClientSettings } from "@/lib/client-settings";

export function useClientSettings() {
  const [settings, setSettings] = useState<ClientSettings>(DEFAULT_CLIENT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadClientSettings();
    setSettings(loaded);
    document.documentElement.classList.toggle("reduce-motion", loaded.reducedMotion);
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<ClientSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveClientSettings(next);
      return next;
    });
  }, []);

  return { settings, update, ready };
}
