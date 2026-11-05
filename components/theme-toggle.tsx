"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { cn } from "@/lib/cn";

const sequence: ThemePreference[] = ["light", "dark", "system"];
const labels: Record<ThemePreference, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme",
};

export function ThemeToggle({ className, expanded = false }: { className?: string; expanded?: boolean }) {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const next = sequence[(sequence.indexOf(theme) + 1) % sequence.length];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-line/80 bg-surface/60 text-muted transition hover:border-brand/40 hover:text-ink",
        expanded ? "h-10 px-3 text-xs font-semibold" : "h-10 w-10",
        className,
      )}
      aria-label={`Current: ${labels[theme]}. Switch to ${labels[next]}.`}
      title={`Current: ${labels[theme]}. Click for ${labels[next]}.`}
    >
      <Icon className="h-4 w-4" />
      {expanded && <span>{labels[theme]}</span>}
    </button>
  );
}
