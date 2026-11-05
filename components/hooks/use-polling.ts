"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function usePolling<T>(
  url: string | null,
  options: {
    intervalMs?: number;
    shouldStop?: (data: T) => boolean;
  } = {},
) {
  const intervalMs = options.intervalMs || 1500;
  const shouldStopRef = useRef(options.shouldStop);
  shouldStopRef.current = options.shouldStop;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let stopped = false;

    const poll = async () => {
      controller = new AbortController();
      try {
        const result = await apiFetch<T>(url, { signal: controller.signal });
        if (!active) return;
        setData(result);
        setError(null);
        setUpdatedAt(new Date());
        stopped = shouldStopRef.current?.(result) || false;
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        if (!(caught instanceof Error && caught.name === "AbortError")) {
          setError(caught instanceof Error ? caught.message : "The status request failed.");
        }
      } finally {
        setLoading(false);
        if (active && !stopped) timer = setTimeout(poll, intervalMs);
      }
    };

    void poll();
    return () => {
      active = false;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs, refreshKey]);

  return { data, error, loading, updatedAt, refresh };
}
