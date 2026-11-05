"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 rounded-2xl border border-line bg-surface/60 p-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-surface-2 ring-1 ring-line")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}
